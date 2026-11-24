const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const demoCtrl = require('../controllers/demo.controller');
const { dashboardLoginLimiter } = require('../middlewares/rateLimit.middlewares');

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Show login form (EJS)
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Login page HTML
 *   post:
 *     summary: Process login credentials
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, session cookie set
 *       401:
 *         description: Invalid credentials
 */
router.get('/login', sessionController.showLogin);
router.post('/login', dashboardLoginLimiter, sessionController.login);

// One-click access to the admin dashboard as the demo admin (DEMO_MODE only)
router.post('/demo-login', dashboardLoginLimiter, demoCtrl.sessionLogin);

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: Logout user and destroy session
 *     tags: [Session]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.get('/logout', sessionController.logout);

module.exports = router;
