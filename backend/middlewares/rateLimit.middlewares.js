const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limiters for sensitive endpoints (brute force / spam protection).
 * Limits can be tuned with environment variables without code changes.
 *
 * NOTE: behind nginx, `app.set('trust proxy', ...)` must be configured so the
 * real client IP is used; otherwise every request shares the proxy's IP.
 */

const minutes = (n) => n * 60 * 1000;
const intFromEnv = (name, fallback) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const jsonHandler = (message) => (req, res, next, options) =>
  res.status(options.statusCode).json({ message });

// Login (API + EJS dashboard): attempts per IP and per email
const loginLimiter = rateLimit({
  windowMs: minutes(15),
  limit: intFromEnv('LOGIN_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Count per IP + email so one attacker cannot lock everyone out,
  // and one account cannot be brute-forced from a single IP.
  keyGenerator: (req, res) => {
    const email = (req.body && typeof req.body.email === 'string') ? req.body.email.toLowerCase() : '';
    return `${ipKeyGenerator(req.ip)}|${email}`;
  },
  skipSuccessfulRequests: true,
  handler: jsonHandler('Too many login attempts. Please try again later.'),
});

// EJS login form: render the page with an error instead of JSON
const dashboardLoginLimiter = rateLimit({
  windowMs: minutes(15),
  limit: intFromEnv('LOGIN_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, next, options) =>
    res.status(options.statusCode).render('login', {
      error: 'Too many login attempts. Please try again later.',
      email: (req.body && req.body.email) || '',
      frontendUrl: req.app.locals.frontendUrl,
    }),
});

// Account creation
const signupLimiter = rateLimit({
  windowMs: minutes(60),
  limit: intFromEnv('SIGNUP_RATE_LIMIT', 5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many accounts created from this IP. Please try again later.'),
});

// Public contact form (spam protection)
const contactLimiter = rateLimit({
  windowMs: minutes(60),
  limit: intFromEnv('CONTACT_RATE_LIMIT', 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many messages sent. Please try again later.'),
});

// One-click demo login (DEMO_MODE): no password, but avoid token farming
const demoLoginLimiter = rateLimit({
  windowMs: minutes(15),
  limit: intFromEnv('DEMO_LOGIN_RATE_LIMIT', 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: jsonHandler('Too many demo logins. Please try again later.'),
});

module.exports = {
  loginLimiter,
  demoLoginLimiter,
  dashboardLoginLimiter,
  signupLimiter,
  contactLimiter,
};
