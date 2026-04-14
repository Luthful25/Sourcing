const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { submitInquiry } = require("../services/contact-service");
const {
  getPublishedNews,
  getFeaturedNews,
  getPublishedNewsBySlug
} = require("../services/news-service");
const { smtp, contact } = require("../config/env");
const { HttpError } = require("../utils/http-error");

const router = express.Router();

router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const result = await submitInquiry({
      body: req.body,
      req,
      smtpConfig: smtp,
      contactConfig: contact
    });

    res.status(200).json(result);
  })
);

router.get(
  "/news",
  asyncHandler(async (_req, res) => {
    const items = await getPublishedNews();
    res.status(200).json({ ok: true, data: items });
  })
);

router.get(
  "/news/featured",
  asyncHandler(async (_req, res) => {
    const item = await getFeaturedNews();
    res.status(200).json({ ok: true, data: item });
  })
);

router.get(
  "/news/:slug",
  asyncHandler(async (req, res) => {
    const article = await getPublishedNewsBySlug(String(req.params.slug || "").trim());

    if (!article) {
      throw new HttpError(404, "News article not found.");
    }

    res.status(200).json({ ok: true, data: article });
  })
);

router.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = { publicRoutes: router };
