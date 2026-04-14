const nodemailer = require("nodemailer");
const { HttpError } = require("../utils/http-error");

const requiredFields = ["email", "country", "website"];
const maxLengths = {
  firstName: 120,
  lastName: 120,
  email: 254,
  country: 120,
  whatsapp: 50,
  website: 300,
  subject: 180,
  message: 5000
};

const trimToEmptyString = (value) => String(value ?? "").trim();

const normalizeInquiry = (body) => {
  const raw = Object(body);

  return {
    firstName: trimToEmptyString(raw.firstName ?? raw["first-name"]),
    lastName: trimToEmptyString(raw.lastName ?? raw["last-name"]),
    email: trimToEmptyString(raw.email),
    country: trimToEmptyString(raw.country),
    whatsapp: trimToEmptyString(raw.whatsapp),
    website: trimToEmptyString(raw.website),
    subject: trimToEmptyString(raw.subject),
    message: trimToEmptyString(raw.message)
  };
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const validateInquiry = (inquiry) => {
  const fieldErrors = {};

  requiredFields.forEach((field) => {
    if (!inquiry[field]) {
      fieldErrors[field] = `${field} is required.`;
    }
  });

  if (inquiry.email && !isValidEmail(inquiry.email)) {
    fieldErrors.email = "Please provide a valid email address.";
  }

  if (inquiry.website && !isValidHttpUrl(inquiry.website)) {
    fieldErrors.website = "Please provide a valid website URL starting with http:// or https://.";
  }

  Object.entries(maxLengths).forEach(([field, maxLength]) => {
    if (inquiry[field] && inquiry[field].length > maxLength) {
      fieldErrors[field] = `${field} must be ${maxLength} characters or fewer.`;
    }
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw new HttpError(400, "Please correct the highlighted fields and try again.", fieldErrors);
  }
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const createTransporter = (smtpConfig) => {
  const { host, port, user, pass, secure } = smtpConfig;

  if (!host || !port || !user || !pass) {
    throw new HttpError(500, "Missing SMTP configuration. Check SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
};

const buildMailContent = (inquiry, meta) => {
  const fullName = [inquiry.firstName, inquiry.lastName].filter(Boolean).join(" ").trim() || "Not provided";

  const text = [
    "New inquiry submitted from empiorsourcing.com",
    "",
    `Submitted At: ${meta.submittedAt}`,
    `IP Address: ${meta.ipAddress}`,
    `User Agent: ${meta.userAgent}`,
    "",
    `Name: ${fullName}`,
    `Email: ${inquiry.email}`,
    `Country/Region: ${inquiry.country}`,
    `WhatsApp: ${inquiry.whatsapp || "Not provided"}`,
    `Website: ${inquiry.website}`,
    `Project Brief: ${inquiry.subject || "Not provided"}`,
    `Message: ${inquiry.message || "Not provided"}`
  ].join("\n");

  const rows = [
    ["Submitted At", meta.submittedAt],
    ["IP Address", meta.ipAddress],
    ["User Agent", meta.userAgent],
    ["Name", fullName],
    ["Email", inquiry.email],
    ["Country/Region", inquiry.country],
    ["WhatsApp", inquiry.whatsapp || "Not provided"],
    ["Website", inquiry.website],
    ["Project Brief", inquiry.subject || "Not provided"],
    ["Message", inquiry.message || "Not provided"]
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 10px;font-weight:700;border:1px solid #d8dee7;">${escapeHtml(
          label
        )}</td><td style="padding:8px 10px;border:1px solid #d8dee7;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;">
      <h2 style="margin:0 0 12px;">New inquiry submitted from empiorsourcing.com</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return { text, html };
};

const submitInquiry = async ({ body, req, smtpConfig, contactConfig }) => {
  const inquiry = normalizeInquiry(body);
  validateInquiry(inquiry);

  const transporter = createTransporter(smtpConfig);

  const meta = {
    submittedAt: new Date().toISOString(),
    ipAddress: String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown"),
    userAgent: String(req.get("user-agent") || "Unknown")
  };

  const { text, html } = buildMailContent(inquiry, meta);
  const sender = [inquiry.firstName, inquiry.lastName].filter(Boolean).join(" ").trim() || inquiry.email;

  await transporter.sendMail({
    from: `"Empior Website" <${contactConfig.from}>`,
    to: contactConfig.to,
    replyTo: inquiry.email,
    subject: `New inquiry from ${sender}`,
    text,
    html
  });

  return {
    ok: true,
    message: "Thanks. Your inquiry has been sent successfully."
  };
};

module.exports = { submitInquiry };
