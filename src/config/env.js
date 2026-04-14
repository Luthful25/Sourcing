const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "changeme";
const DEFAULT_ADMIN_SECRET = "change-this-admin-auth-secret";
const MIN_ADMIN_SECRET_LENGTH = 32;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const splitEmails = (value) =>
  String(value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const isProduction = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
const mysqlPort = Number(process.env.MYSQL_PORT);
const mysqlConnectionLimit = Number(process.env.MYSQL_CONNECTION_LIMIT);

const smtpUser = String(process.env.SMTP_USER ?? "").trim();
const configuredRecipients = splitEmails(process.env.CONTACT_TO);
const fallbackRecipients = configuredRecipients.length ? configuredRecipients : ["info@empiorsourcing.com"];
const contactRecipients = [...new Set([...fallbackRecipients, smtpUser].filter(Boolean))];

const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH ?? "").trim().toLowerCase();
const adminPasswordPlain = String(process.env.ADMIN_PASSWORD ?? "").trim();

const evaluateProductionAdminSecurity = (adminAuth) => {
  const issues = [];
  const username = String(adminAuth?.username ?? "").trim();
  const passwordHash = String(adminAuth?.passwordHash ?? "").trim().toLowerCase();
  const passwordPlain = String(adminAuth?.passwordPlain ?? "").trim();
  const secret = String(adminAuth?.secret ?? "").trim();

  if (!username) {
    issues.push("ADMIN_USERNAME must be configured.");
  } else if (username.toLowerCase() === DEFAULT_ADMIN_USERNAME) {
    issues.push("ADMIN_USERNAME must not use the default 'admin' value in production.");
  }

  if (!passwordHash) {
    issues.push("ADMIN_PASSWORD_HASH is required in production.");
  } else {
    if (!SHA256_HEX_PATTERN.test(passwordHash)) {
      issues.push("ADMIN_PASSWORD_HASH must be a 64-character SHA-256 hex string.");
    }

    if (passwordHash === sha256(DEFAULT_ADMIN_PASSWORD)) {
      issues.push("ADMIN_PASSWORD_HASH must not match the default 'changeme' password.");
    }
  }

  if (passwordPlain) {
    issues.push("ADMIN_PASSWORD must not be set in production. Use ADMIN_PASSWORD_HASH only.");
  }

  if (!secret) {
    issues.push("ADMIN_AUTH_SECRET must be configured in production.");
  } else {
    if (secret === DEFAULT_ADMIN_SECRET) {
      issues.push("ADMIN_AUTH_SECRET must not use the default value.");
    }

    if (secret.length < MIN_ADMIN_SECRET_LENGTH) {
      issues.push(`ADMIN_AUTH_SECRET must be at least ${MIN_ADMIN_SECRET_LENGTH} characters long.`);
    }
  }

  return issues;
};

const assertProductionAdminSecurity = ({ isProduction, adminAuth }) => {
  if (!isProduction) {
    return;
  }

  const issues = evaluateProductionAdminSecurity(adminAuth);
  if (issues.length === 0) {
    return;
  }

  throw new Error(
    [
      "Insecure admin authentication configuration for production.",
      ...issues.map((issue) => `- ${issue}`)
    ].join("\n")
  );
};

const config = {
  rootDir,
  isProduction,
  port: Number(process.env.PORT) || 3000,
  mysql: {
    host: String(process.env.MYSQL_HOST ?? "127.0.0.1").trim() || "127.0.0.1",
    port: Number.isFinite(mysqlPort) && mysqlPort > 0 ? mysqlPort : 3306,
    user: String(process.env.MYSQL_USER ?? "root").trim(),
    password: String(process.env.MYSQL_PASSWORD ?? ""),
    database: String(process.env.MYSQL_DATABASE ?? "empior").trim() || "empior",
    connectionLimit:
      Number.isFinite(mysqlConnectionLimit) && mysqlConnectionLimit > 0 ? mysqlConnectionLimit : 10
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    user: smtpUser,
    pass: process.env.SMTP_PASS
  },
  contact: {
    recipients: contactRecipients,
    to: contactRecipients.join(", "),
    from: process.env.CONTACT_FROM || smtpUser || contactRecipients[0] || "info@empiorsourcing.com"
  },
  adminAuth: {
    username: String(process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME).trim(),
    passwordHash: adminPasswordHash,
    passwordPlain: adminPasswordPlain,
    secret: String(process.env.ADMIN_AUTH_SECRET ?? DEFAULT_ADMIN_SECRET).trim(),
    tokenTtlHours: Number(process.env.ADMIN_TOKEN_TTL_HOURS) || 8
  }
};

assertProductionAdminSecurity(config);

module.exports = {
  ...config,
  securityDefaults: {
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_SECRET,
    MIN_ADMIN_SECRET_LENGTH
  },
  evaluateProductionAdminSecurity,
  assertProductionAdminSecurity
};
