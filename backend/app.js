/**
 * Express application: middleware, routes and views. It does not listen on
 * any port, so tests can import it (`require('./app')`) and drive it with
 * supertest. The HTTP/HTTPS servers and Socket.IO are started in index.js.
 */
const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const swaggerUI = require("swagger-ui-express");
const swaggerSpecs = require("./swagger");
const { isAdmin } = require('./middlewares/role.middlewares');
const morgan = require('morgan');
const logger = require('./utils/logger');

const env = process.env.NODE_ENV || 'development';
// `.env.<env>.local` (git-ignored) is loaded first so it takes precedence and
// can hold real secrets; `.env.<env>` keeps the non-secret defaults.
dotenv.config({ path: path.resolve(__dirname, `.env.${env}.local`) });
dotenv.config({ path: path.resolve(__dirname, `.env.${env}`) });

// Fail fast: never start with missing or publicly known secrets.
const { assertRequiredSecrets, getSessionSecret } = require('./config/secrets');
assertRequiredSecrets();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();

// Behind nginx the real client IP is in X-Forwarded-For. Trust exactly the
// configured number of proxy hops (default 1) so rate limiting and secure
// cookies work. Set TRUST_PROXY=0 when the app is exposed directly.
const trustProxyHops = parseInt(process.env.TRUST_PROXY ?? '1', 10);
app.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 1);

// Security headers and Content-Security-Policy with a per-request nonce
// (SEC-23), see config/security-headers.js. HTTPS-only extras (HSTS,
// upgrade-insecure-requests) follow SESSION_COOKIE_SECURE=true.
const { cspNonce, securityHeaders } = require('./config/security-headers');
app.use(cspNonce);
app.use(securityHeaders({ httpsOnly: (process.env.SESSION_COOKIE_SECURE || '').toLowerCase() === 'true' }));

// Use morgan to log HTTP requests via winston
const morganFormat = ":method :url :status :response-time ms";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
// d3 for the dashboard charts is served locally (no third-party script in the CSP)
app.use('/vendor/d3', express.static(path.join(__dirname, 'node_modules', 'd3', 'dist')));
// Allowed origins come from CORS_ORIGINS / FRONTEND_URL plus this server's own
// origin (see config/cors.js)
const { corsOptionsDelegate } = require('./config/cors');
app.use(cors(corsOptionsDelegate({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  // X-Requested-With guards /api/auth/refresh and /logout against CSRF
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
})));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI Configuration
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs));
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

//Setting the view to ejs
app.set('view engine', 'ejs');

// Make frontend URL available in all templates
app.locals.frontendUrl = FRONTEND_URL;

// Public test site (DEMO_MODE=true): one-click demo accounts + banner in EJS views
app.locals.demoMode = require('./services/demo.service').isDemoMode();

// Serialize data for embedding inside <script> blocks in EJS views.
// Plain JSON.stringify does not escape "</script>", which allowed stored XSS.
app.locals.safeJson = (value) =>
  JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const cookieParser = require('cookie-parser');
const session = require('express-session');

// Signed cookies (CSRF token of the EJS dashboard) use the session secret
app.use(cookieParser(getSessionSecret()));

// SESSION_COOKIE_SECURE=true on HTTPS hosts (Render, nginx + TLS) so cookies
// are never sent over plain HTTP; "auto" follows req.secure (needs the trust
// proxy setting above). Default false keeps local HTTP working.
const sessionCookieSecure = (() => {
  const value = (process.env.SESSION_COOKIE_SECURE || 'false').toLowerCase();
  if (value === 'auto') return 'auto';
  return value === 'true';
})();
app.set('sessionCookieSecure', sessionCookieSecure);

const db = require("./models");

// Persistent session store in production (SEC-16), see config/session-store.js
const { createSessionStore, SESSION_TTL_MS } = require('./config/session-store');

app.use(session({
  name: process.env.SESSION_NAME || 'awtc.sid',
  secret: getSessionSecret(),
  store: createSessionStore(session, db.sequelize),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: sessionCookieSecure,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS
  }
}));


// NOTE: the former /debug-models and /debug-messages routes were removed:
// they were public and dumped users, contacts, private messages and push
// subscriptions (see AUDIT_REPORT.md, SEC-02).

// Two separate authentication chains (AUDIT_REPORT.md, SEC-13):
//  - JSON API (/api/*): Bearer JWT only. The session cookie is ignored, so a
//    cross-site request can never act with the dashboard session (no CSRF).
//  - EJS dashboard (everything else): server-side session only, and every
//    state-changing form carries a CSRF token (middlewares/csrf.middlewares.js).
const authMiddleware = require("./middlewares/auth.middlewares");
const { provideCsrfToken } = require("./middlewares/csrf.middlewares");
const isApiRequest = (req) => req.path === '/api' || req.path.startsWith('/api/');

app.use((req, res, next) => (isApiRequest(req) ? authMiddleware(req, res, next) : next()));

app.use(async (req, res, next) => {
  if (isApiRequest(req)) return next();
  req.user = null;
  try {
    if (req.session && req.session.userId) {
      const user = await db.User.findByPk(req.session.userId);
      req.user = user || null;
    }
  } catch (err) {
    console.error('Session attach error:', err.message);
    req.user = null;
  }
  next();
});

app.use((req, res, next) => (isApiRequest(req) ? next() : provideCsrfToken(req, res, next)));


// Load API Routes
const projectRoutes = require("./routes/project.routes");
const reviewRoutes = require("./routes/reviews.routes");
const categoryRoutes = require("./routes/category.routes");
const userRoutes = require("./routes/user.routes");
const contactRoutes = require("./routes/contact.routes");
const sessionRoutes = require("./routes/session.routes");
const externalRoutes = require("./routes/external.routes");
const messageRoutes = require("./routes/message.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const demoRoutes = require("./routes/demo.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/api/projects", projectRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/external", externalRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/demo", demoRoutes);
app.use("/api/auth", authRoutes);
app.use('/', sessionRoutes);

// EJS admin dashboard pages (routes/dashboard.routes.js)
app.use('/', dashboardRoutes);


const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

app.use((req, res, next) => {
  // Skip frontend serving for API routes and dashboard routes
  if (req.path.startsWith("/api") ||
      req.path === "/login" ||
      req.path === "/logout" ||
      dashboardRoutes.DASHBOARD_PATHS.includes(req.path)) {
    return next();
  }
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Centralised error handling (must be registered after all routes)
const { apiNotFound, errorHandler } = require('./middlewares/errorHandler.middlewares');
app.use('/api', apiNotFound);
app.use(errorHandler);

module.exports = app;
