const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const demoCtrl = require('../controllers/demo.controller');
const { dashboardLoginLimiter } = require('../middlewares/rateLimit.middlewares');
const { verifyCsrfToken } = require('../middlewares/csrf.middlewares');

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
router.post('/login', verifyCsrfToken, dashboardLoginLimiter, sessionController.login);

// One-click access to the admin dashboard as the demo admin (DEMO_MODE only)
router.post('/demo-login', verifyCsrfToken, dashboardLoginLimiter, demoCtrl.sessionLogin);

/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Logout user and destroy session (EJS form with CSRF token)
 *     tags: [Session]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [_csrf]
 *             properties:
 *               _csrf:
 *                 type: string
 *     responses:
 *       302:
 *         description: Logged out, redirects to /login
 *       403:
 *         description: Missing or invalid CSRF token
 */
// POST + CSRF: a link or <img> on another site can no longer log the admin out
router.post('/logout', verifyCsrfToken, sessionController.logout);

module.exports = router;
