const express = require("express");
const { adminAuth, isProduction, securityDefaults } = require("../config/env");
const { asyncHandler } = require("../utils/async-handler");
const { HttpError } = require("../utils/http-error");
const { createToken, sha256, timingSafeEqual } = require("../utils/auth-token");
const { AUTH_COOKIE_NAME, requireAdminAuth } = require("../middleware/admin-auth");
const {
  validateCreateNewsPayload,
  validateUpdateNewsPayload
} = require("../utils/news-validation");
const {
  createNewsArticle,
  updateNewsArticle,
  deleteNewsArticle,
  getAdminNewsById,
  getAdminNewsList
} = require("../services/news-service");
const {
  uploadNewsImageSingle,
  getUploadedImagePath,
  removeUploadedFileIfExists
} = require("../utils/news-upload");

const router = express.Router();

const resolveExpectedPasswordHash = () => {
  if (adminAuth.passwordHash) {
    return String(adminAuth.passwordHash).toLowerCase();
  }

  if (adminAuth.passwordPlain) {
    return sha256(adminAuth.passwordPlain);
  }

  return sha256(securityDefaults.DEFAULT_ADMIN_PASSWORD);
};

const validateAdminCredentials = ({ username, password }) => {
  const expectedUsername = adminAuth.username;
  const expectedPasswordHash = resolveExpectedPasswordHash();

  const incomingUsername = String(username ?? "").trim();
  const incomingPasswordHash = sha256(String(password ?? ""));

  const isUsernameValid = timingSafeEqual(incomingUsername, expectedUsername);
  const isPasswordValid = timingSafeEqual(incomingPasswordHash, expectedPasswordHash);
  return isUsernameValid && isPasswordValid;
};

const createAdminSessionToken = (username) =>
  createToken({
    subject: username,
    secret: adminAuth.secret,
    expiresInMs: adminAuth.tokenTtlHours * 60 * 60 * 1000
  });

const setAdminCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: adminAuth.tokenTtlHours * 60 * 60 * 1000,
    path: "/"
  });
};

const clearAdminCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
};

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Invalid news id.");
  }
  return id;
};

const buildPayloadInput = (req) => {
  const uploadedImagePath = getUploadedImagePath(req.file);
  if (uploadedImagePath) {
    return {
      ...req.body,
      image: uploadedImagePath
    };
  }

  return { ...req.body };
};

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      throw new HttpError(400, "username and password are required.");
    }

    const isValid = validateAdminCredentials({ username, password });
    if (!isValid) {
      throw new HttpError(401, "Invalid admin credentials.");
    }

    const token = createAdminSessionToken(username);
    setAdminCookie(res, token);

    res.status(200).json({
      ok: true,
      message: "Admin login successful.",
      token,
      data: {
        username
      }
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearAdminCookie(res);
    res.status(200).json({ ok: true, message: "Admin session ended." });
  })
);

router.get(
  "/session",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    res.status(200).json({ ok: true, data: req.admin });
  })
);

router.get(
  "/news",
  requireAdminAuth,
  asyncHandler(async (_req, res) => {
    const articles = await getAdminNewsList();
    res.status(200).json({ ok: true, data: articles });
  })
);

router.post(
  "/news",
  requireAdminAuth,
  uploadNewsImageSingle("image"),
  asyncHandler(async (req, res) => {
    try {
      const payloadInput = buildPayloadInput(req);
      const payload = validateCreateNewsPayload(payloadInput);
      const created = await createNewsArticle(payload);
      res.status(201).json({ ok: true, data: created });
    } catch (error) {
      removeUploadedFileIfExists(req.file);
      throw error;
    }
  })
);

router.put(
  "/news/:id",
  requireAdminAuth,
  uploadNewsImageSingle("image"),
  asyncHandler(async (req, res) => {
    try {
      const id = parseId(req.params.id);

      if (!(await getAdminNewsById(id))) {
        throw new HttpError(404, "News article not found.");
      }

      const payloadInput = buildPayloadInput(req);
      const payload = validateUpdateNewsPayload(payloadInput);
      const updated = await updateNewsArticle({ id, payload });

      res.status(200).json({ ok: true, data: updated });
    } catch (error) {
      removeUploadedFileIfExists(req.file);
      throw error;
    }
  })
);

router.delete(
  "/news/:id",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const deleted = await deleteNewsArticle(id);
    res.status(200).json({ ok: true, data: deleted });
  })
);

module.exports = { adminRoutes: router };
