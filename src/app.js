const path = require("path");
const express = require("express");
const { rootDir } = require("./config/env");
const { publicRoutes } = require("./routes/public-routes");
const { adminRoutes } = require("./routes/admin-routes");
const { systemRoutes } = require("./routes/system-routes");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler");

const app = express();

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: false, limit: "12mb" }));

app.use("/uploads", express.static(path.join(rootDir, "uploads")));
app.use(express.static(rootDir));

app.use("/api", publicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/", systemRoutes);

app.get("/", (_req, res) => {
  res.sendFile(path.join(rootDir, "Home.html"));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };
