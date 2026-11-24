const express = require('express');
const router = express.Router();
const demoCtrl = require('../controllers/demo.controller');
const { requireDemoMode } = require('../middlewares/demo.middlewares');
const { demoLoginLimiter } = require('../middlewares/rateLimit.middlewares');

/**
 * @swagger
 * /api/demo:
 *   get:
 *     summary: Public demo-mode configuration
 *     tags: [Demo]
 *     security: []
 *     responses:
 *       200:
 *         description: "{ enabled: false } or { enabled: true, maxUploadMb, accounts: [{ role, name }] }"
 */
router.get('/', demoCtrl.getConfig);

/**
 * @swagger
 * /api/demo/login:
 *   post:
 *     summary: Sign in as one of the shared demo accounts (only when DEMO_MODE=true)
 *     tags: [Demo]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [volunteer, coordinator, admin]
 *     responses:
 *       200:
 *         description: Login successful, returns access_token
 *       400:
 *         description: Invalid demo role
 *       404:
 *         description: Demo mode disabled
 */
router.post('/login', requireDemoMode, demoLoginLimiter, demoCtrl.login);

module.exports = router;
