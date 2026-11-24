/**
 * Image storage abstraction.
 *
 * STORAGE_PROVIDER=local (default) -> files written to backend/public/images
 *                                     (stored value: the file name, as before)
 * STORAGE_PROVIDER=cloudinary      -> files uploaded to Cloudinary
 *                                     (stored value: the absolute https URL)
 *
 * Cloudinary is needed on hosts with an ephemeral disk (e.g. Render free tier).
 * Credentials come from CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 */
const fs = require('fs');
const path = require('path');

const LOCAL_DIR = path.join(__dirname, '..', 'public', 'images');
const CLOUDINARY_ROOT_FOLDER = process.env.CLOUDINARY_FOLDER || 'awtc';

let cloudinaryClient = null;

function getProvider() {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider !== 'local' && provider !== 'cloudinary') {
    throw new Error(`[config] Invalid STORAGE_PROVIDER "${provider}". Use "local" or "cloudinary".`);
  }
  return provider;
}

const isRemote = () => getProvider() === 'cloudinary';

function getCloudinary() {
  if (!cloudinaryClient) {
    if (!process.env.CLOUDINARY_URL) {
      throw new Error('[config] STORAGE_PROVIDER=cloudinary requires CLOUDINARY_URL');
    }
    // The SDK reads CLOUDINARY_URL from the environment automatically
    cloudinaryClient = require('cloudinary').v2;
    cloudinaryClient.config({ secure: true });
  }
  return cloudinaryClient;
}

function uploadBufferToCloudinary(buffer, folder) {
  const cloudinary = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${CLOUDINARY_ROOT_FOLDER}/${folder}`,
        resource_type: 'image',
        // Cloudinary inspects the real content and rejects non-images
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

/**
 * Express middleware to run right after `upload.single(...)`.
 * With Cloudinary it uploads the in-memory file and replaces
 * `req.file.filename` with the public URL, so controllers keep working.
 */
function persistUpload(folder) {
  return async (req, res, next) => {
    if (!req.file || !isRemote()) return next();
    try {
      const result = await uploadBufferToCloudinary(req.file.buffer, folder);
      req.file.filename = result.secure_url;
      req.file.isRemote = true;
      req.file.buffer = undefined; // free memory
      return next();
    } catch (err) {
      console.error('Cloudinary upload failed:', err.message);
      return res.status(400).json({ message: 'Error uploading image' });
    }
  };
}

const isAbsoluteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Value to store for review images (they historically keep a "/images/<name>" path).
 */
function toStoredImagePath(file) {
  if (!file) return null;
  return file.isRemote || isAbsoluteUrl(file.filename) ? file.filename : `/images/${file.filename}`;
}

/** Public path/URL for a stored file name or URL (e.g. profile images). */
function toPublicUrl(value) {
  if (!value) return null;
  if (isAbsoluteUrl(value) || value.startsWith('/')) return value;
  return `/images/${value}`;
}

/** Extracts the Cloudinary public_id from a delivery URL. */
function cloudinaryPublicIdFromUrl(url) {
  const match = /\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+)\.[a-z0-9]+$/i.exec(url);
  return match ? match[1] : null;
}

/** Best-effort deletion of a previously stored image (local path, file name or Cloudinary URL). */
async function removeUpload(value) {
  if (!value) return;
  try {
    if (isAbsoluteUrl(value)) {
      if (!/res\.cloudinary\.com/i.test(value) || !process.env.CLOUDINARY_URL) return;
      const publicId = cloudinaryPublicIdFromUrl(value);
      if (publicId) await getCloudinary().uploader.destroy(publicId, { resource_type: 'image' });
      return;
    }
    // Local: only ever delete inside the uploads directory (no path traversal)
    const fileName = path.basename(value);
    const filePath = path.join(LOCAL_DIR, fileName);
    if (filePath.startsWith(LOCAL_DIR) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn('Could not remove stored image:', err.message);
  }
}

module.exports = {
  getProvider,
  isRemote,
  persistUpload,
  toStoredImagePath,
  toPublicUrl,
  removeUpload,
  cloudinaryPublicIdFromUrl,
  LOCAL_DIR,
};
