const { pool, withTransaction } = require("../db/database");
const { rootDir } = require("../config/env");
const { HttpError } = require("../utils/http-error");
const { slugify } = require("../utils/slug");
const {
  saveBase64Image,
  deleteManagedImageIfExists,
  normalizeImagePath
} = require("../utils/image-storage");

const rowToNews = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    image: row.image,
    featured: Boolean(row.featured),
    publishDate: row.publish_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const nowIso = () => new Date().toISOString();

const getRowById = async ({ id, executor = pool }) => {
  const [rows] = await executor.query("SELECT * FROM news_articles WHERE id = ? LIMIT 1", [Number(id)]);
  return rows[0] || null;
};

const getRowBySlug = async ({ slug, executor = pool }) => {
  const [rows] = await executor.query("SELECT * FROM news_articles WHERE slug = ? LIMIT 1", [slug]);
  return rows[0] || null;
};

const ensureUniqueSlug = async ({ preferredSlug, fallbackTitle, excludeId = null, executor = pool }) => {
  const baseSlug = slugify(preferredSlug || fallbackTitle || "news-item") || "news-item";

  let attempt = 0;
  while (attempt < 5000) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await getRowBySlug({ slug: candidate, executor });

    if (!existing || (excludeId !== null && Number(existing.id) === Number(excludeId))) {
      return candidate;
    }

    attempt += 1;
  }

  throw new HttpError(500, "Could not generate a unique slug. Please try again.");
};

const assertFound = (row, message = "News article not found.") => {
  if (!row) {
    throw new HttpError(404, message);
  }
};

const enforceFeaturedState = ({ featured, status }) => {
  if (featured && status !== "published") {
    throw new HttpError(400, "Only published articles can be featured.");
  }
};

const persistImageFromPayload = ({ payload, existingImage = "" }) => {
  const trimmedImage = normalizeImagePath(payload.image);
  const hasNewBase64 = Boolean(payload.imageBase64);

  if (hasNewBase64) {
    const savedPath = saveBase64Image({
      rootDir,
      imageBase64: payload.imageBase64,
      imageMimeType: payload.imageMimeType
    });

    if (!savedPath) {
      throw new HttpError(400, "Image upload failed.");
    }

    if (existingImage && existingImage !== savedPath) {
      deleteManagedImageIfExists({ rootDir, imagePath: existingImage });
    }

    return savedPath;
  }

  if (trimmedImage) {
    if (existingImage && existingImage !== trimmedImage) {
      deleteManagedImageIfExists({ rootDir, imagePath: existingImage });
    }
    return trimmedImage;
  }

  return existingImage;
};

const createNewsArticle = async (payload) => {
  const timestamp = nowIso();
  const slug = await ensureUniqueSlug({ preferredSlug: payload.slug, fallbackTitle: payload.title });
  const imagePath = persistImageFromPayload({ payload });

  if (!imagePath) {
    throw new HttpError(400, "An image is required for each news article.");
  }

  const featured = payload.featured ? 1 : 0;
  enforceFeaturedState({ featured: Boolean(featured), status: payload.status });

  return withTransaction(async (connection) => {
    if (featured) {
      await connection.query("UPDATE news_articles SET featured = 0 WHERE featured = 1");
    }

    const [insertResult] = await connection.query(
      `
        INSERT INTO news_articles (
          title,
          slug,
          category,
          short_description,
          full_description,
          image,
          featured,
          publish_date,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.title,
        slug,
        payload.category,
        payload.shortDescription,
        payload.fullDescription,
        imagePath,
        featured,
        payload.publishDate,
        payload.status,
        timestamp,
        timestamp
      ]
    );

    const createdRow = await getRowById({ id: insertResult.insertId, executor: connection });
    return rowToNews(createdRow);
  });
};

const updateNewsArticle = async ({ id, payload }) => {
  const existingRow = await getRowById({ id });
  assertFound(existingRow);

  const existing = rowToNews(existingRow);
  const merged = {
    title: payload.title ?? existing.title,
    slug: payload.slug ?? existing.slug,
    category: payload.category ?? existing.category,
    shortDescription: payload.shortDescription ?? existing.shortDescription,
    fullDescription: payload.fullDescription ?? existing.fullDescription,
    publishDate: payload.publishDate ?? existing.publishDate,
    status: payload.status ?? existing.status,
    featured: typeof payload.featured === "boolean" ? payload.featured : existing.featured
  };

  if (merged.status !== "published") {
    merged.featured = false;
  }

  enforceFeaturedState({ featured: merged.featured, status: merged.status });

  const normalizedSlug = await ensureUniqueSlug({
    preferredSlug: merged.slug,
    fallbackTitle: merged.title,
    excludeId: Number(id)
  });

  const imagePath = persistImageFromPayload({
    payload,
    existingImage: existing.image
  });

  if (!imagePath) {
    throw new HttpError(400, "An image is required for each news article.");
  }

  const updatedAt = nowIso();

  return withTransaction(async (connection) => {
    if (merged.featured) {
      await connection.query("UPDATE news_articles SET featured = 0 WHERE featured = 1");
    }

    await connection.query(
      `
        UPDATE news_articles
        SET
          title = ?,
          slug = ?,
          category = ?,
          short_description = ?,
          full_description = ?,
          image = ?,
          featured = ?,
          publish_date = ?,
          status = ?,
          updated_at = ?
        WHERE id = ?
      `,
      [
        merged.title,
        normalizedSlug,
        merged.category,
        merged.shortDescription,
        merged.fullDescription,
        imagePath,
        merged.featured ? 1 : 0,
        merged.publishDate,
        merged.status,
        updatedAt,
        Number(id)
      ]
    );

    const updatedRow = await getRowById({ id: Number(id), executor: connection });
    return rowToNews(updatedRow);
  });
};

const deleteNewsArticle = async (id) => {
  const existing = rowToNews(await getRowById({ id }));
  assertFound(existing);

  await pool.query("DELETE FROM news_articles WHERE id = ?", [Number(id)]);
  deleteManagedImageIfExists({ rootDir, imagePath: existing.image });

  return {
    ok: true,
    id: Number(id)
  };
};

const getPublishedNews = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM news_articles WHERE status = 'published' AND publish_date <= ? ORDER BY publish_date DESC, id DESC",
    [nowIso()]
  );
  return rows.map(rowToNews);
};

const getFeaturedNews = async () => {
  const timestamp = nowIso();
  const [featuredRows] = await pool.query(
    "SELECT * FROM news_articles WHERE status = 'published' AND publish_date <= ? AND featured = 1 LIMIT 1",
    [timestamp]
  );

  if (featuredRows[0]) {
    return rowToNews(featuredRows[0]);
  }

  const [fallbackRows] = await pool.query(
    "SELECT * FROM news_articles WHERE status = 'published' AND publish_date <= ? ORDER BY publish_date DESC, id DESC LIMIT 1",
    [timestamp]
  );

  return rowToNews(fallbackRows[0] || null);
};

const getPublishedNewsBySlug = async (slug) => {
  const [rows] = await pool.query(
    "SELECT * FROM news_articles WHERE slug = ? AND status = 'published' AND publish_date <= ? LIMIT 1",
    [slug, nowIso()]
  );
  return rowToNews(rows[0] || null);
};

const getAdminNewsById = async (id) => rowToNews(await getRowById({ id: Number(id) }));

const getAdminNewsList = async () => {
  const [rows] = await pool.query("SELECT * FROM news_articles ORDER BY created_at DESC, id DESC");
  return rows.map(rowToNews);
};

module.exports = {
  createNewsArticle,
  updateNewsArticle,
  deleteNewsArticle,
  getPublishedNews,
  getFeaturedNews,
  getPublishedNewsBySlug,
  getAdminNewsById,
  getAdminNewsList
};
