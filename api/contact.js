const nodemailer = require("nodemailer");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.CONTACT_TO || "alimentriai@gmail.com";

  if (!user || !pass) {
    return json(res, 503, {
      ok: false,
      error:
        "Email is not configured yet. Set SMTP_USER and SMTP_PASS in Vercel environment variables.",
    });
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const company = String(body.company || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !message) {
    return json(res, 400, {
      ok: false,
      error: "Name, email, and message are required.",
    });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return json(res, 400, { ok: false, error: "Invalid email address." });
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = `[Alimentri Contact] ${name}${company ? ` — ${company}` : ""}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    company ? `Company: ${company}` : null,
    "",
    "Message:",
    message,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <h2>New contact from alimentri.com</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
  `;

  try {
    await transporter.sendMail({
      from: `"Alimentri Website" <${user}>`,
      to,
      replyTo: email,
      subject,
      text,
      html,
    });
    return json(res, 200, { ok: true, message: "Thank you — we will be in touch soon." });
  } catch (err) {
    console.error("SMTP error:", err);
    return json(res, 500, {
      ok: false,
      error: "Could not send message. Please try again or email us directly.",
    });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
