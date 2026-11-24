const { User } = require('../models');
const demo = require('../services/demo.service');

const DEMO_PROTECTED_MESSAGE = 'Demo accounts cannot be modified or deleted';

/** Only expose a route when DEMO_MODE=true (404 otherwise, as if it did not exist). */
exports.requireDemoMode = (req, res, next) => {
  if (!demo.isDemoMode()) return res.status(404).json({ message: 'Not found' });
  next();
};

/**
 * Blocks operations on the user identified by `req.params.id`
 * (role change, deletion) when it is one of the shared demo accounts.
 */
exports.protectDemoTarget = async (req, res, next) => {
  if (!demo.isDemoMode()) return next();
  try {
    const target = await User.findByPk(req.params.id, { attributes: ['id', 'email'] });
    if (target && demo.isDemoAccount(target)) {
      return res.status(403).json({ message: DEMO_PROTECTED_MESSAGE });
    }
    next();
  } catch (err) {
    next(err);
  }
};

/** Blocks the authenticated demo account from deleting itself. */
exports.protectDemoSelf = (req, res, next) => {
  if (demo.isDemoMode() && req.user && demo.isDemoAccount(req.user)) {
    return res.status(403).json({ message: DEMO_PROTECTED_MESSAGE });
  }
  next();
};

exports.DEMO_PROTECTED_MESSAGE = DEMO_PROTECTED_MESSAGE;
