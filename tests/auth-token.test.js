const test = require("node:test");
const assert = require("node:assert/strict");
const { createToken, verifyToken, parseCookies } = require("../src/utils/auth-token");

test("createToken + verifyToken returns a valid payload", () => {
  const secret = "unit-test-secret";
  const token = createToken({
    subject: "admin-user",
    expiresInMs: 60_000,
    secret
  });

  const payload = verifyToken({ token, secret });
  assert.ok(payload);
  assert.equal(payload.sub, "admin-user");
  assert.equal(typeof payload.exp, "number");
  assert.ok(payload.exp > Date.now());
});

test("verifyToken rejects tampered tokens", () => {
  const secret = "unit-test-secret";
  const token = createToken({
    subject: "admin-user",
    expiresInMs: 60_000,
    secret
  });

  const [encodedPayload, signature] = token.split(".");
  const tamperedPayload = `${encodedPayload}x.${signature}`;
  const tamperedSignature = `${encodedPayload}.${signature.slice(0, -1)}x`;

  assert.equal(verifyToken({ token: tamperedPayload, secret }), null);
  assert.equal(verifyToken({ token: tamperedSignature, secret }), null);
});

test("verifyToken rejects expired tokens", () => {
  const token = createToken({
    subject: "admin-user",
    expiresInMs: -1,
    secret: "unit-test-secret"
  });

  assert.equal(verifyToken({ token, secret: "unit-test-secret" }), null);
});

test("parseCookies decodes values and ignores malformed pairs", () => {
  const parsed = parseCookies("a=1; token=hello%20world; malformed; x=y=z");

  assert.deepEqual(parsed, {
    a: "1",
    token: "hello world",
    x: "y=z"
  });
});
