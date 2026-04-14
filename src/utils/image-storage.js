const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { HttpError } = require("./http-error");

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg"
};

const normalizeImagePath = (value) => String(value ?? "").trim();

const isManagedNewsUpload = (imagePath) =>
  /^\/uploads\/news\/[a-zA-Z0-9-_.]+$/.test(normalizeImagePath(imagePath));

const resolveManagedUploadPath = (rootDir, imagePath) =>
  path.join(rootDir, normalizeImagePath(imagePath).replace(/^\//, ""));

const saveBase64Image = ({ rootDir, imageBase64, imageMimeType }) => {
  const data = String(imageBase64 ?? "").trim();
  if (!data) {
    return null;
  }

  let mimeType = String(imageMimeType ?? "").trim().toLowerCase();
  let base64Payload = data;

  const dataUriMatch = data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    base64Payload = dataUriMatch[2];
  }

  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new HttpError(400, "Unsupported image format. Use JPEG, PNG, WEBP, GIF, AVIF, or SVG.");
  }

  let imageBuffer;
  try {
    imageBuffer = Buffer.from(base64Payload, "base64");
  } catch {
    throw new HttpError(400, "Invalid image data. Could not decode base64 payload.");
  }

  if (!imageBuffer.length) {
    throw new HttpError(400, "Invalid image data. Empty payload.");
  }

  const maxBytes = 6 * 1024 * 1024;
  if (imageBuffer.length > maxBytes) {
    throw new HttpError(400, "Image is too large. Maximum supported size is 6 MB.");
  }

  const uploadDirectory = path.join(rootDir, "uploads", "news");
  fs.mkdirSync(uploadDirectory, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const absolutePath = path.join(uploadDirectory, fileName);

  fs.writeFileSync(absolutePath, imageBuffer);
  return `/uploads/news/${fileName}`;
};

const deleteManagedImageIfExists = ({ rootDir, imagePath }) => {
  if (!isManagedNewsUpload(imagePath)) {
    return;
  }

  const absolutePath = resolveManagedUploadPath(rootDir, imagePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

module.exports = {
  normalizeImagePath,
  isManagedNewsUpload,
  saveBase64Image,
  deleteManagedImageIfExists
};
