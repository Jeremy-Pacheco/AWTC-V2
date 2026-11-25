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
  allowedHeaders: ['Content-Type', 'Authorization'],
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


// Helper: try model.findAll(), if it errors (e.g. unknown column) fallback to raw SELECT * from table
async function safeFindAll(model) {
  if (!model) return [];
  try {
    return await model.findAll();
  } catch (err) {
    try {
      const tableName = typeof model.getTableName === 'function' ? model.getTableName() : (model.tableName || model.name || null);
      if (!tableName) throw err;
      console.warn(`Model query failed for ${model.name}, falling back to raw SELECT * FROM ${tableName}:`, err.message);
      const [rows] = await db.sequelize.query(`SELECT * FROM \`${tableName}\``);
      // Raw rows bypass the model's defaultScope: never leak password hashes
      return rows.map(({ passwordHash, ...row }) => row);
    } catch (err2) {
      console.error('Fallback raw query also failed for model', model && model.name, err2.message);
      return [];
    }
  }
}

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

app.use("/api/projects", projectRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/external", externalRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/demo", demoRoutes);
app.use('/', sessionRoutes);

// Simple EJS dashboard routes (demo)
// Helper to gather dashboard data used by multiple routes
async function getDashboardData() {
  const projects = (await safeFindAll(db.Project)) || [];
  const users = (await safeFindAll(db.User)) || [];
  const categories = (await safeFindAll(db.Category)) || [];
  
  // Load reviews with their associated users
  let reviews = [];
  try {
    reviews = await db.Reviews.findAll({
      include: [{ model: db.User, as: 'user', attributes: ['id', 'email', 'name', 'role'] }]
    });
  } catch (err) {
    console.warn('Could not load reviews with users:', err.message);
    reviews = (await safeFindAll(db.Reviews)) || [];
  }
  
  // Load message counts per user
  let messageCountsPerUser = {};
  try {
    if (db.Message) {
      // First, check if there are any messages in the database
      const allMessages = await db.Message.findAll();
      console.log('Total messages in database:', allMessages.length);
      
      const [messageCounts] = await db.sequelize.query(
        `SELECT senderId as userId, COUNT(*) as messageCount
         FROM \`Messages\`
         GROUP BY senderId`
      );
      console.log('Message counts per user (raw query):', messageCounts);
      messageCounts.forEach(row => {
        messageCountsPerUser[row.userId] = parseInt(row.messageCount) || 0;
      });
      console.log('Message counts map:', messageCountsPerUser);
    } else {
      console.warn('Message model not available');
    }
  } catch (err) {
    console.warn('Could not load message counts:', err.message, err.stack);
  }
  
  // Add message counts to reviews
  reviews = reviews.map(review => {
    const reviewData = review.toJSON ? review.toJSON() : review;
    const userId = reviewData.user?.id;
    const msgCount = messageCountsPerUser[userId] || 0;
    console.log(`Review user ID: ${userId}, messageCount from map: ${msgCount}`);
    return {
      ...reviewData,
      messageCount: msgCount
    };
  });
  console.log('Final reviews with message counts:', reviews.map(r => ({ userId: r.user?.id, messageCount: r.messageCount, userName: r.user?.name })));
  
  const contacts = db.Contact ? (await safeFindAll(db.Contact)) : [];

  const recent = (arr, n = 5) => {
    if (!Array.isArray(arr)) return [];
    const copy = arr.slice();
    copy.sort((a,b) => {
      const aDate = a && (a.createdAt || a.created_at || a.date) ? new Date(a.createdAt || a.created_at || a.date) : null;
      const bDate = b && (b.createdAt || b.created_at || b.date) ? new Date(b.createdAt || b.created_at || b.date) : null;
      if (aDate && bDate) return bDate - aDate;
      if (aDate) return -1;
      if (bDate) return 1;
      return (b.id || 0) - (a.id || 0);
    });
    return copy.slice(0, n);
  };

  const result = {
    projects,
    users,
    categories,
    reviews,
    contacts,
    latestUsers: recent(users,6),
    latestProjects: recent(projects,6),
    latestReviews: recent(reviews,10)
  };

  // Compute volunteers per project and projects with volunteer list if join model is defined
  try {
    if (db.UserProject && db.Project && db.User) {
      // counts per project
      const [userCounts] = await db.sequelize.query(
        `SELECT p.id as projectId, p.name as projectName, COUNT(up.userId) as volunteersCount
         FROM \`Projects\` p
         LEFT JOIN \`UserProjects\` up ON up.projectId = p.id
         GROUP BY p.id, p.name`
      );
      result.usersPerProject = userCounts;

      // Additionally, load the projects with users (when many-to-many is supported)
      try {
        const projectsWithVolunteers = await db.Project.findAll({
          include: [{ model: db.User, through: { attributes: ['status','role'] } }]
        });
        result.projectsWithVolunteers = projectsWithVolunteers;
      } catch (err) {
        result.projectsWithVolunteers = null;
      }

      // Get projects per user (how many projects each user is registered in)
      try {
        const [projectsPerUser] = await db.sequelize.query(
          `SELECT u.id as userId, u.name as userName, u.email, COUNT(up.projectId) as projectCount
           FROM \`Users\` u
           LEFT JOIN \`UserProjects\` up ON up.userId = u.id
           GROUP BY u.id, u.name, u.email
           ORDER BY projectCount DESC`
        );
        result.projectsPerUser = projectsPerUser;
        
        // Also get all UserProjects for frontend
        const allUserProjects = await db.UserProject.findAll({
          attributes: ['userId', 'projectId', 'status', 'role', 'createdAt', 'updatedAt']
        });
        result.allUserProjects = allUserProjects;
      } catch (err) {
        console.warn('Could not compute projectsPerUser:', err.message);
        result.projectsPerUser = null;
        result.allUserProjects = [];
      }
    }
  } catch (err) {
    console.warn('Could not compute usersPerProject or projectsWithVolunteers:', err.message);
    result.usersPerProject = null;
    result.projectsWithVolunteers = null;
    result.projectsPerUser = null;
  }

  return result;
}

// Render dashboard with specified section
async function renderDashboard(req, res, section = 'overview', extra = {}) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') {
    return res.status(403).render('access-denied', { currentUser: req.user, frontendUrl: FRONTEND_URL });
  }
  try {
    const data = await getDashboardData();
    console.log(`Dashboard counts -> projects: ${data.projects.length}, users: ${data.users.length}, categories: ${data.categories.length}, reviews: ${data.reviews.length}`);
    console.log(`Section: ${section}, latestProjects: ${data.latestProjects?.length}, latestUsers: ${data.latestUsers?.length}`);
    console.log(`ProjectsPerUser data:`, data.projectsPerUser ? `${data.projectsPerUser.length} users` : 'null');
    console.log('Reviews before render:', JSON.stringify(data.reviews.map(r => ({ userId: r.user?.id, messageCount: r.messageCount }))));
    // compute current user's registrations and bans if any
    const userRegisteredProjectIds = req.user ? (await db.UserProject.findAll({ where: { userId: req.user.id } })).map(r => r.projectId) : [];
    const userBannedProjectIds = req.user ? (await db.UserProjectBan.findAll({ where: { userId: req.user.id } })).map(b => b.projectId) : [];

    res.render('index', Object.assign({
      shopName: 'A Will To Change',
      currentUser: req.user || null,
      currentSection: section,
      frontendUrl: FRONTEND_URL,
      userRegisteredProjectIds: userRegisteredProjectIds,
      userBannedProjectIds: userBannedProjectIds,
      projectsNumber: Array.isArray(data.projects) ? data.projects.length : 0,
      usersNumber: Array.isArray(data.users) ? data.users.length : 0,
      categoriesNumber: Array.isArray(data.categories) ? data.categories.length : 0,
      reviewsNumber: Array.isArray(data.reviews) ? data.reviews.length : 0,
      contactsNumber: Array.isArray(data.contacts) ? data.contacts.length : 0
    }, data, extra));
  } catch (err) {
    console.error('Error fetching data for dashboard:', err.message);
    res.render('index', {
      shopName: 'A Will To Change',
      projects: [], projectsNumber: 0,
      users: [], usersNumber: 0,
      categories: [], categoriesNumber: 0,
      reviews: [], reviewsNumber: 0,
      contacts: [], contactsNumber: 0,
      currentUser: req.user || null,
      currentSection: section,
      frontendUrl: FRONTEND_URL
    });
  }
}

app.get('/', (req, res) => renderDashboard(req, res, 'overview'));
app.get('/projects', (req, res) => renderDashboard(req, res, 'projects'));
// Volunteers of one project (projects section): goes through renderDashboard
// so the admin check and all the usual view data apply (BUG-07, SEC-08)
app.get('/projects/:id/volunteers', async (req, res) => {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') {
    return res.status(403).render('access-denied', { currentUser: req.user, frontendUrl: FRONTEND_URL });
  }
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) return res.redirect('/projects');
  try {
    const project = await db.Project.findByPk(projectId, { include: [{ model: db.User, through: { attributes: ['status', 'role'] } }] });
    if (!project) return res.redirect('/projects');
    return renderDashboard(req, res, 'projects', {
      projectVolunteers: project.Users || [],
      projectName: project.name
    });
  } catch (err) {
    console.error('Error loading project volunteers:', err.message);
    return res.redirect('/projects');
  }
});
app.get('/overview', (req, res) => renderDashboard(req, res, 'overview'));
app.get('/users', (req, res) => renderDashboard(req, res, 'users'));
app.get('/categories', (req, res) => renderDashboard(req, res, 'categories'));
app.get('/reviews', (req, res) => renderDashboard(req, res, 'reviews'));
app.get('/contacts', (req, res) => renderDashboard(req, res, 'contacts'));


const frontendPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

app.use((req, res, next) => {
  // Skip frontend serving for API routes and dashboard routes
  if (req.path.startsWith("/api") ||
      req.path === "/login" || 
      req.path === "/logout" ||
      req.path === "/" ||
      req.path === "/overview" ||
      req.path === "/projects" ||
      req.path === "/users" ||
      req.path === "/categories" ||
      req.path === "/reviews" ||
      req.path === "/contacts") {
    return next();
  }
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Centralised error handling (must be registered after all routes)
const { apiNotFound, errorHandler } = require('./middlewares/errorHandler.middlewares');
app.use('/api', apiNotFound);
app.use(errorHandler);

module.exports = app;
