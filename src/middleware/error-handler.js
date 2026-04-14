const { HttpError } = require("../utils/http-error");

const DB_UNAVAILABLE_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"]);
const DB_CONFIGURATION_CODES = new Set(["ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"]);

const notFoundHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (error, _req, res, _next) => {
  const upstreamCode = String(error?.code ?? "");

  let statusCode = Number(error?.statusCode) || 500;
  if (!Number(error?.statusCode)) {
    if (DB_UNAVAILABLE_CODES.has(upstreamCode)) {
      statusCode = 503;
    } else if (DB_CONFIGURATION_CODES.has(upstreamCode)) {
      statusCode = 500;
    }
  }

  const message = (() => {
    if (statusCode >= 500 && DB_UNAVAILABLE_CODES.has(upstreamCode)) {
      return "Database service is unavailable. Please try again.";
    }

    if (statusCode >= 500 && DB_CONFIGURATION_CODES.has(upstreamCode)) {
      return "Database configuration error. Please contact support.";
    }

    if (statusCode >= 500) {
      return "Internal server error. Please try again.";
    }

    return error?.message || "Request failed.";
  })();

  if (statusCode >= 500) {
    console.error(error);
  }

  const payload = {
    ok: false,
    message
  };

  if (error?.details && typeof error.details === "object") {
    payload.fieldErrors = error.details;
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
