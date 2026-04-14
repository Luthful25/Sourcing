const mysql = require("mysql2/promise");
const { mysql: mysqlConfig } = require("../config/env");

const pool = mysql.createPool({
  host: mysqlConfig.host,
  port: mysqlConfig.port,
  user: mysqlConfig.user,
  password: mysqlConfig.password,
  database: mysqlConfig.database,
  waitForConnections: true,
  connectionLimit: mysqlConfig.connectionLimit,
  connectTimeout: 10000,
  queueLimit: 0
});

let initPromise;

const createDatabaseIfNeeded = async () => {
  const connection = await mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password
  });

  try {
    await connection.query(
      "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
      [mysqlConfig.database]
    );
  } finally {
    await connection.end();
  }
};

const initDatabase = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await createDatabaseIfNeeded();

      await pool.query(`
        CREATE TABLE IF NOT EXISTS news_articles (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          title VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          short_description TEXT NOT NULL,
          full_description LONGTEXT NOT NULL,
          image TEXT NOT NULL,
          featured TINYINT(1) NOT NULL DEFAULT 0,
          publish_date VARCHAR(64) NOT NULL,
          status ENUM('draft', 'published') NOT NULL,
          created_at VARCHAR(64) NOT NULL,
          updated_at VARCHAR(64) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_news_slug (slug),
          KEY idx_news_publish_date (publish_date),
          KEY idx_news_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    })();
  }

  try {
    await initPromise;
  } catch (error) {
    initPromise = undefined;
    throw error;
  }
};

const withTransaction = async (handler) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const pingDatabase = async () => {
  const [rows] = await pool.query("SELECT 1 AS ok");
  return rows[0]?.ok === 1;
};

module.exports = { pool, initDatabase, withTransaction, pingDatabase };
