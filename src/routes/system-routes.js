const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { initDatabase, pingDatabase } = require("../db/database");
const { mapDatabaseError } = require("../db/database-errors");

const router = express.Router();

router.get(
  "/test-db",
  asyncHandler(async (_req, res) => {
    try {
      await initDatabase();
      const reachable = await pingDatabase();
      res.status(200).json({
        ok: true,
        message: "Database connection successful.",
        data: {
          reachable
        }
      });
    } catch (error) {
      const mapped = mapDatabaseError(error);
      res.status(mapped.statusCode).json({
        ok: false,
        message: mapped.message,
        code: mapped.code,
        hint: mapped.hint
      });
    }
  })
);

module.exports = { systemRoutes: router };
