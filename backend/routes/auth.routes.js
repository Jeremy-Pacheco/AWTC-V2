const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/auth.controller');
const { refreshLimiter } = require('../middlewares/rateLimit.middlewares');

/**
 * The refresh cookie is sent automatically by the browser, so these
 * endpoints require a custom header: browsers only send it from origins
 * allowed by CORS (it triggers a preflight), which blocks cross-site
 * request forgery.
 */
function requireAjaxHeader(req, res, next) {
  if (req.get('X-Requested-With') !== 'awtc') {
    return res.status(403).json({ message: 'Missing X-Requested-With header' });
  }
  next();
}

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renew the session with the httpOnly refresh cookie
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Requested-With
 *         required: true
 *         schema: { type: string, enum: [awtc] }
 *     responses:
 *       200:
 *         description: New short-lived access token; the refresh cookie is rotated
 *       401:
 *         description: Missing, expired, revoked or reused refresh token
 */
router.post('/refresh', requireAjaxHeader, refreshLimiter, authCtrl.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out on the server (revokes the refresh token)
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Requested-With
 *         required: true
 *         schema: { type: string, enum: [awtc] }
 *     responses:
 *       204:
 *         description: Logged out
 */
router.post('/logout', requireAjaxHeader, authCtrl.logout);

module.exports = router;
