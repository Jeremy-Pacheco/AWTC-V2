const express = require('express');
const router = express.Router();
const controller = require('../controllers/contact.controller');
const authMiddleware = require('../middlewares/auth.middlewares');
const { isAdmin } = require('../middlewares/role.middlewares');
const { contactLimiter } = require('../middlewares/rateLimit.middlewares');
const { validate } = require('../middlewares/validate.middlewares');
const schemas = require('../validation/schemas');

/**
 * @swagger
 * /api/contacts:
 *   post:
 *     summary: Create a new contact message
 *     tags: [Contacts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Contact'
 *     responses:
 *       201:
 *         description: Contact created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Bad request
 *   get:
 *     summary: Get all contact messages
 *     tags: [Contacts]
 *     responses:
 *       200:
 *         description: List of contacts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contact'
 */
router.post('/', contactLimiter, validate({ body: schemas.contactCreate }), controller.create);
router.get('/', authMiddleware, isAdmin, controller.findAll);

/**
 * @swagger
 * /api/contacts/{id}:
 *   get:
 *     summary: Get a contact message by ID
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contact data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contact'
 *       404:
 *         description: Contact not found
 *   put:
 *     summary: Update a contact message
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Contact'
 *     responses:
 *       200:
 *         description: Contact updated
 *       404:
 *         description: Contact not found
 *   delete:
 *     summary: Delete a contact message
 *     tags: [Contacts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contact deleted
 *       404:
 *         description: Contact not found
 */
router.get('/:id', authMiddleware, isAdmin, validate({ params: schemas.idParams }), controller.findOne);
router.put('/:id', authMiddleware, isAdmin, validate({ params: schemas.idParams, body: schemas.contactUpdate }), controller.update);
router.delete('/:id', authMiddleware, isAdmin, validate({ params: schemas.idParams }), controller.delete);

module.exports = router;
