const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const multer = require("multer");
const { rootDir } = require("../config/env");
const { HttpError } = require("./http-error");

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const uploadDir = path.join(rootDir, "uploads", "news");

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg"
};

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const extension = EXTENSION_BY_MIME[String(file.mimetype || "").toLowerCase()];
    const safeExtension = extension || "bin";
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${safeExtension}`;
    callback(null, fileName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_BYTES
  },
  fileFilter: (_req, file, callback) => {
    const mimeType = String(file.mimetype || "").toLowerCase();
    if (!EXTENSION_BY_MIME[mimeType]) {
      callback(new HttpError(400, "Unsupported image format. Use JPEG, PNG, WEBP, GIF, AVIF, or SVG."));
      return;
    }

    callback(null, true);
  }
});

const mapMulterErrorToHttpError = (error) => {
  if (!error) return null;
  if (error instanceof HttpError) return error;

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new HttpError(400, "Image is too large. Maximum supported size is 6 MB.");
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return new HttpError(400, "Unexpected upload field. Use the 'image' field name for image uploads.");
    }

    return new HttpError(400, `Image upload failed: ${error.message}`);
  }

  return new HttpError(400, "Image upload failed.");
};

const uploadNewsImageSingle = (fieldName = "image") => (req, res, next) => {
  upload.single(fieldName)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    next(mapMulterErrorToHttpError(error));
  });
};

const getUploadedImagePath = (file) => {
  if (!file || !file.filename) {
    return "";
  }
  return `/uploads/news/${file.filename}`;
};

const removeUploadedFileIfExists = (file) => {
  const filePath = String(file?.path || "").trim();
  if (!filePath) {
    return;
  }

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  uploadNewsImageSingle,
  getUploadedImagePath,
  removeUploadedFileIfExists
};
