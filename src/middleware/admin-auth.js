const { adminAuth } = require("../config/env");
const { parseCookies, verifyToken } = require("../utils/auth-token");
const { HttpError } = require("../utils/http-error");

const AUTH_COOKIE_NAME = "empior_admin_auth";

const extractToken = (req) => {
  const authHeader = req.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
};

const requireAdminAuth = (req, _res, next) => {
  const token = extractToken(req);
  const payload = verifyToken({ token, secret: adminAuth.secret });

  if (!payload) {
    return next(new HttpError(401, "Authentication required."));
  }

  req.admin = {
    username: payload.sub
  };

  return next();
};

module.exports = {
  AUTH_COOKIE_NAME,
  requireAdminAuth,
  extractToken
};
