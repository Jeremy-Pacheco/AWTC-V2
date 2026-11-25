const express = require("express");
const router = express.Router();
const reviewsController = require("../controllers/reviews.controller");
const authMiddleware = require("../middlewares/auth.middlewares");
// Shared uploader: image MIME whitelist, size limit (5MB, 1MB in DEMO_MODE) and server-chosen extension.
// Never keep the client's original extension (it allowed .html/.svg uploads -> XSS).
const upload = require("../multer/upload");
const { handleUploadError } = upload;
const { persistUpload } = require("../services/storage.service");
const { validate } = require("../middlewares/validate.middlewares");
const schemas = require("../validation/schemas");

/**
 * @swagger
 * /api/reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Great experience volunteering here!"
 *               image:
 *                 type: string
 *                 format: binary
 *             required:
 *               - content
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *     responses:
 *       200:
 *         description: List of all reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 *       500:
 *         description: Server error
 */
router.post(
  "/",
  authMiddleware,
  upload.single("image"),
  handleUploadError,
  validate({ body: schemas.reviewCreate }),
  persistUpload("reviews"),
  reviewsController.createReview
);
router.get("/", reviewsController.getAllReviews);

/**
 * @swagger
 * /api/reviews/{id}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 example: "Updated review content"
 *               image:
 *                 type: string
 *                 format: binary
 *               removeImage:
 *                 type: string
 *                 example: "true"
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Review not found
 */
router.put(
  "/:id",
  authMiddleware,
  upload.single("image"),
  handleUploadError,
  validate({ params: schemas.idParams, body: schemas.reviewUpdate }),
  persistUpload("reviews"),
  reviewsController.updateReview
);

router.delete("/:id", authMiddleware, validate({ params: schemas.idParams }), reviewsController.deleteReview);

module.exports = router;
