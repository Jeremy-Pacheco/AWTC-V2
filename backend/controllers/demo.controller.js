const { User } = require('../models');
const demo = require('../services/demo.service');
const utils = require('../utils/utils');
const logger = require('../utils/logger');

/** Loads the demo account for `role`, or null when the role/account is unknown. */
async function findDemoUser(role) {
  const account = typeof role === 'string' ? demo.findDemoAccount(role) : null;
  if (!account) return null;
  return User.findOne({ where: { email: account.email } });
}

// GET /api/demo -> public demo configuration (works with DEMO_MODE off too)
exports.getConfig = (req, res) => {
  res.json(demo.getPublicConfig());
};

// POST /api/demo/login { role } -> JWT for the shared demo account (DEMO_MODE only)
exports.login = async (req, res) => {
  try {
    const role = req.body && req.body.role;
    if (!demo.findDemoAccount(role)) {
      return res.status(400).json({ message: 'Invalid demo role' });
    }

    const user = await findDemoUser(role);
    if (!user) {
      // Accounts are created by scripts/reset-demo.js
      return res.status(503).json({ message: 'Demo accounts are not available yet. Please try again later.' });
    }

    logger.info(`Demo login as ${role}`);
    res.json({
      message: 'Login successful',
      user: utils.getCleanUser(user),
      access_token: utils.generateToken(user),
    });
  } catch (err) {
    console.error('Demo login error:', err.message);
    res.status(500).json({ message: 'Error signing in' });
  }
};

// POST /demo-login (EJS admin dashboard) -> server-side session for the demo admin
exports.sessionLogin = async (req, res) => {
  if (!demo.isDemoMode()) return res.status(404).send('Not found');
  const renderError = (error) =>
    res.status(503).render('login', { error, email: '', frontendUrl: req.app.locals.frontendUrl });
  try {
    const user = await findDemoUser('admin');
    if (!user) return renderError('Demo accounts are not available yet. Please try again later.');

    // Regenerate the session id on login (prevents session fixation)
    req.session.regenerate((err) => {
      if (err) return renderError('Unexpected error during login');
      req.session.userId = user.id;
      req.session.userRole = user.role;
      logger.info('Demo login as admin (dashboard)');
      return res.redirect('/');
    });
  } catch (err) {
    console.error('Demo session login error:', err.message);
    return renderError('Unexpected error during login');
  }
};
