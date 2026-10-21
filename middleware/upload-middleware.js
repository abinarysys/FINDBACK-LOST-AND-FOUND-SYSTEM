// Checks uploaded images and stores accepted files for item posts.

// middleware/upload-middleware.js
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(__dirname, "..", "public", "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      cb(null, crypto.randomBytes(16).toString("hex") + EXT[file.mimetype]);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    cb(new Error("Only JPG, PNG or WebP images are allowed."));
  },
});

// Profile picture upload middleware
const uploadPfp = upload.single("pfp");

// Validate uploaded profile picture
const verifyImage = (req, res, next) => {
  if (req.file && !EXT[req.file.mimetype]) {
    return res.status(400).send("Only JPG, PNG or WebP images are allowed.");
  }
  next();
};

// Keep the Multer object available for existing lost/found/profile routes
upload.uploadPfp = uploadPfp;
upload.verifyImage = verifyImage;

module.exports = upload;
