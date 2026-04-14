const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCreateNewsPayload, validateUpdateNewsPayload } = require("../src/utils/news-validation");

test("validateCreateNewsPayload normalizes valid payload", () => {
  const payload = validateCreateNewsPayload({
    title: "Factory Update",
    category: "Operations",
    shortDescription: "Short summary",
    fullDescription: "Detailed summary",
    image: "/assets/our.jpg"
  });

  assert.equal(payload.title, "Factory Update");
  assert.equal(payload.status, "draft");
  assert.equal(payload.featured, false);
  assert.equal(payload.image, "/assets/our.jpg");
  assert.match(payload.publishDate, /^\d{4}-\d{2}-\d{2}T/);
});

test("validateCreateNewsPayload rejects invalid status and featured combination", () => {
  assert.throws(
    () =>
      validateCreateNewsPayload({
        title: "Factory Update",
        category: "Operations",
        shortDescription: "Short summary",
        fullDescription: "Detailed summary",
        image: "/assets/our.jpg",
        status: "live",
        featured: "maybe"
      }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "Validation failed.");
      assert.equal(error.details.status, "status must be either draft or published.");
      assert.equal(error.details.featured, "featured must be a boolean.");
      return true;
    }
  );
});

test("validateUpdateNewsPayload rejects empty updates", () => {
  assert.throws(
    () => validateUpdateNewsPayload({}),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.message, "No updatable fields were provided.");
      return true;
    }
  );
});

test("validateUpdateNewsPayload accepts partial updates and normalizes publishDate", () => {
  const payload = validateUpdateNewsPayload({
    title: "  Updated Title  ",
    featured: "yes",
    publishDate: "2026-04-15"
  });

  assert.deepEqual(payload.title, "Updated Title");
  assert.equal(payload.featured, true);
  assert.match(payload.publishDate, /^2026-04-15T/);
});
