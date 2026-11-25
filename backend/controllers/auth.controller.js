const tokenService = require('../services/token.service');
const utils = require('../utils/utils');

// POST /api/auth/refresh -> new access token, rotated refresh cookie
exports.refresh = async (req, res) => {
  try {
    const { user, accessToken } = await tokenService.refreshSession(req, res);
    res.json({ access_token: accessToken, user: utils.getCleanUser(user) });
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ message: err.message });
    console.error('Refresh error:', err.message);
    res.status(500).json({ message: 'Error refreshing session' });
  }
};

// POST /api/auth/logout -> revokes the refresh token family on the server
exports.logout = async (req, res) => {
  try {
    await tokenService.endSession(req, res);
    res.status(204).end();
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ message: 'Error logging out' });
  }
};
