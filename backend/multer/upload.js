var multer = require('multer');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// Ensure the upload directory exists
var uploadDir = path.join(__dirname, '..', 'public', 'images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created upload directory:', uploadDir);
}

var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists before each upload (in case it was deleted)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('Recreated upload directory:', uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    var filetype = '';
    if(file.mimetype === 'image/gif') filetype = 'gif';
    else if(file.mimetype === 'image/png') filetype = 'png';
    else if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') filetype = 'jpg';
    else if(file.mimetype === 'image/webp') filetype = 'webp';
    else filetype = 'bin';

    // Random suffix avoids collisions between concurrent uploads in the same ms
    cb(null, 'image-' + Date.now() + '-' + crypto.randomBytes(8).toString('hex') + '.' + filetype);
  }
});

// File filter to only accept images
var fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), false);
  }
};

var upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Turns multer / fileFilter errors into a 400 JSON response instead of a 500
upload.handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ message: 'Upload error' });
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'Error uploading file' });
  }
  next();
};

module.exports = upload;
