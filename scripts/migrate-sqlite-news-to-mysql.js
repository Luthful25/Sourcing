const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { rootDir } = require("../src/config/env");
const { initDatabase, withTransaction, pool } = require("../src/db/database");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    source: path.join(rootDir, "data", "empior.sqlite")
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--source" && args[index + 1]) {
      options.source = path.resolve(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--source=")) {
      options.source = path.resolve(arg.slice("--source=".length));
    }
  }

  return options;
};

const readSqliteNews = (sqlitePath) => {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found: ${sqlitePath}`);
  }

  const sqliteDb = new DatabaseSync(sqlitePath);

  try {
    const hasNewsTable = sqliteDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'news_articles' LIMIT 1")
      .get();

    if (!hasNewsTable) {
      return [];
    }

    return sqliteDb
      .prepare(
        `
          SELECT
            id,
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
          FROM news_articles
          ORDER BY id ASC
        `
      )
      .all();
  } finally {
    sqliteDb.close();
  }
};

const migrateNewsRows = async (rows) => {
  if (rows.length === 0) {
    return {
      migrated: 0,
      featuredSlug: null
    };
  }

  const featuredSourceRow = [...rows].reverse().find((row) => Number(row.featured) === 1);
  const featuredSlug = featuredSourceRow ? String(featuredSourceRow.slug || "").trim() : null;

  return withTransaction(async (connection) => {
    for (const row of rows) {
      await connection.query(
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
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            category = VALUES(category),
            short_description = VALUES(short_description),
            full_description = VALUES(full_description),
            image = VALUES(image),
            featured = 0,
            publish_date = VALUES(publish_date),
            status = VALUES(status),
            created_at = VALUES(created_at),
            updated_at = VALUES(updated_at)
        `,
        [
          String(row.title ?? ""),
          String(row.slug ?? ""),
          String(row.category ?? ""),
          String(row.short_description ?? ""),
          String(row.full_description ?? ""),
          String(row.image ?? ""),
          String(row.publish_date ?? ""),
          String(row.status ?? "draft"),
          String(row.created_at ?? ""),
          String(row.updated_at ?? "")
        ]
      );
    }

    await connection.query("UPDATE news_articles SET featured = 0 WHERE featured = 1");

    if (featuredSlug) {
      await connection.query(
        "UPDATE news_articles SET featured = 1 WHERE slug = ? AND status = 'published' LIMIT 1",
        [featuredSlug]
      );
    }

    return {
      migrated: rows.length,
      featuredSlug
    };
  });
};

const run = async () => {
  const { source } = parseArgs();

  console.log(`Reading SQLite source: ${source}`);
  const rows = readSqliteNews(source);
  console.log(`Found ${rows.length} article(s) in SQLite.`);

  await initDatabase();
  const result = await migrateNewsRows(rows);

  console.log(`Migrated ${result.migrated} article(s) into MySQL.`);
  if (result.featuredSlug) {
    console.log(`Featured article slug set to: ${result.featuredSlug}`);
  } else {
    console.log("No featured article found in source; all records are non-featured.");
  }
};

run()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("SQLite to MySQL migration failed.");
    console.error(error);
    try {
      await pool.end();
    } catch {
      // Ignore close errors so original failure remains visible.
    }
    process.exit(1);
  });
