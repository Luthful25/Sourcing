const crypto = require("crypto");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertProductionAdminSecurity,
  evaluateProductionAdminSecurity,
  securityDefaults
} = require("../src/config/env");

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const buildSecureAdminAuth = () => ({
  username: "empior-admin-prod",
  passwordHash: hash("A-very-strong-password-2026!"),
  passwordPlain: "",
  secret: "prod-secret-key-minimum-thirty-two-characters",
  tokenTtlHours: 8
});

test("assertProductionAdminSecurity allows non-production defaults", () => {
  assert.doesNotThrow(() =>
    assertProductionAdminSecurity({
      isProduction: false,
      adminAuth: {
        username: securityDefaults.DEFAULT_ADMIN_USERNAME,
        passwordHash: "",
        passwordPlain: securityDefaults.DEFAULT_ADMIN_PASSWORD,
        secret: securityDefaults.DEFAULT_ADMIN_SECRET
      }
    })
  );
});

test("evaluateProductionAdminSecurity flags risky settings", () => {
  const issues = evaluateProductionAdminSecurity({
    username: securityDefaults.DEFAULT_ADMIN_USERNAME,
    passwordHash: hash(securityDefaults.DEFAULT_ADMIN_PASSWORD),
    passwordPlain: securityDefaults.DEFAULT_ADMIN_PASSWORD,
    secret: securityDefaults.DEFAULT_ADMIN_SECRET
  });

  assert.ok(issues.some((issue) => issue.includes("default 'admin'")));
  assert.ok(issues.some((issue) => issue.includes("default 'changeme'")));
  assert.ok(issues.some((issue) => issue.includes("must not be set in production")));
  assert.ok(issues.some((issue) => issue.includes("must not use the default value")));
});

test("assertProductionAdminSecurity rejects weak production credentials", () => {
  assert.throws(
    () =>
      assertProductionAdminSecurity({
        isProduction: true,
        adminAuth: {
          username: securityDefaults.DEFAULT_ADMIN_USERNAME,
          passwordHash: "",
          passwordPlain: securityDefaults.DEFAULT_ADMIN_PASSWORD,
          secret: "short-secret"
        }
      }),
    /Insecure admin authentication configuration for production/
  );
});

test("assertProductionAdminSecurity accepts hardened production credentials", () => {
  assert.doesNotThrow(() =>
    assertProductionAdminSecurity({
      isProduction: true,
      adminAuth: buildSecureAdminAuth()
    })
  );
});
