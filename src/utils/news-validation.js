const { HttpError } = require("./http-error");

const NEWS_STATUSES = new Set(["draft", "published"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const trim = (value) => String(value ?? "").trim();

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "") return false;
  return null;
};

const normalizeDateToIso = (value) => {
  const input = trim(value);
  if (!input) {
    return null;
  }

  const parsedDate = new Date(input);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
};

const enforceLength = (name, value, maxLength, fieldErrors) => {
  if (value && value.length > maxLength) {
    fieldErrors[name] = `${name} must be ${maxLength} characters or fewer.`;
  }
};

const normalizeNewsInput = (rawBody) => {
  const body = Object(rawBody);
  return {
    title: trim(body.title),
    slug: trim(body.slug),
    category: trim(body.category),
    shortDescription: trim(body.shortDescription ?? body.short_description),
    fullDescription: trim(body.fullDescription ?? body.full_description),
    image: trim(body.image),
    imageBase64: trim(body.imageBase64 ?? body.image_base64),
    imageMimeType: trim(body.imageMimeType ?? body.image_mime_type).toLowerCase(),
    featuredRaw: body.featured,
    publishDateRaw: body.publishDate ?? body.publish_date,
    status: trim(body.status).toLowerCase()
  };
};

const validateCreateNewsPayload = (rawBody) => {
  const normalized = normalizeNewsInput(rawBody);
  const fieldErrors = {};

  if (!normalized.title) fieldErrors.title = "title is required.";
  if (!normalized.category) fieldErrors.category = "category is required.";
  if (!normalized.shortDescription) fieldErrors.shortDescription = "shortDescription is required.";
  if (!normalized.fullDescription) fieldErrors.fullDescription = "fullDescription is required.";
  if (!normalized.image && !normalized.imageBase64) fieldErrors.image = "image or imageBase64 is required.";

  enforceLength("title", normalized.title, 180, fieldErrors);
  enforceLength("slug", normalized.slug, 180, fieldErrors);
  enforceLength("category", normalized.category, 80, fieldErrors);
  enforceLength("shortDescription", normalized.shortDescription, 500, fieldErrors);
  enforceLength("fullDescription", normalized.fullDescription, 12000, fieldErrors);
  enforceLength("image", normalized.image, 500, fieldErrors);

  if (normalized.slug && !SLUG_PATTERN.test(normalized.slug)) {
    fieldErrors.slug = "slug must contain only lowercase letters, numbers, and hyphens.";
  }

  const status = normalized.status || "draft";
  if (!NEWS_STATUSES.has(status)) {
    fieldErrors.status = "status must be either draft or published.";
  }

  const featured = parseBoolean(normalized.featuredRaw);
  if (featured === null) {
    fieldErrors.featured = "featured must be a boolean.";
  }

  const publishDate = normalized.publishDateRaw ? normalizeDateToIso(normalized.publishDateRaw) : new Date().toISOString();
  if (!publishDate) {
    fieldErrors.publishDate = "publishDate must be a valid date.";
  }

  if (featured && status !== "published") {
    fieldErrors.featured = "Only published articles can be featured.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError(400, "Validation failed.", fieldErrors);
  }

  return {
    title: normalized.title,
    slug: normalized.slug,
    category: normalized.category,
    shortDescription: normalized.shortDescription,
    fullDescription: normalized.fullDescription,
    image: normalized.image,
    imageBase64: normalized.imageBase64,
    imageMimeType: normalized.imageMimeType,
    featured,
    publishDate,
    status
  };
};

const validateUpdateNewsPayload = (rawBody) => {
  const normalized = normalizeNewsInput(rawBody);
  const fieldErrors = {};
  const payload = {};

  if (normalized.title) {
    enforceLength("title", normalized.title, 180, fieldErrors);
    payload.title = normalized.title;
  }

  if (normalized.slug) {
    enforceLength("slug", normalized.slug, 180, fieldErrors);
    if (!SLUG_PATTERN.test(normalized.slug)) {
      fieldErrors.slug = "slug must contain only lowercase letters, numbers, and hyphens.";
    }
    payload.slug = normalized.slug;
  }

  if (normalized.category) {
    enforceLength("category", normalized.category, 80, fieldErrors);
    payload.category = normalized.category;
  }

  if (normalized.shortDescription) {
    enforceLength("shortDescription", normalized.shortDescription, 500, fieldErrors);
    payload.shortDescription = normalized.shortDescription;
  }

  if (normalized.fullDescription) {
    enforceLength("fullDescription", normalized.fullDescription, 12000, fieldErrors);
    payload.fullDescription = normalized.fullDescription;
  }

  if (normalized.image) {
    enforceLength("image", normalized.image, 500, fieldErrors);
    payload.image = normalized.image;
  }

  if (normalized.imageBase64) {
    payload.imageBase64 = normalized.imageBase64;
    payload.imageMimeType = normalized.imageMimeType;
  }

  if (normalized.status) {
    if (!NEWS_STATUSES.has(normalized.status)) {
      fieldErrors.status = "status must be either draft or published.";
    } else {
      payload.status = normalized.status;
    }
  }

  if (typeof normalized.featuredRaw !== "undefined") {
    const featured = parseBoolean(normalized.featuredRaw);
    if (featured === null) {
      fieldErrors.featured = "featured must be a boolean.";
    } else {
      payload.featured = featured;
    }
  }

  if (typeof normalized.publishDateRaw !== "undefined") {
    const publishDate = normalizeDateToIso(normalized.publishDateRaw);
    if (!publishDate) {
      fieldErrors.publishDate = "publishDate must be a valid date.";
    } else {
      payload.publishDate = publishDate;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError(400, "Validation failed.", fieldErrors);
  }

  if (Object.keys(payload).length === 0) {
    throw new HttpError(400, "No updatable fields were provided.");
  }

  return payload;
};

module.exports = {
  NEWS_STATUSES,
  validateCreateNewsPayload,
  validateUpdateNewsPayload
};
