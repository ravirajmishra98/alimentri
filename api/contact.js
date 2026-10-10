const nodemailer = require("nodemailer");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body == null || req.body === "") return {};
  if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
  return JSON.parse(raw);
}

function createGmailTransporter(user, pass, portOverride) {
  const port = portOverride ?? Number(process.env.SMTP_PORT || 465);
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      minVersion: "TLSv1.2",
      servername: host,
    },
    ...(secure ? {} : { requireTLS: true }),
  });
}

function smtpHint(err) {
  const code = err && err.code;
  const response = (err && err.response) || "";

  if (code === "EAUTH" || /535|534|Authentication/i.test(response)) {
    return "Gmail rejected the login. Use a 16-character App Password (Google Account → Security → App passwords), not your normal Gmail password. Remove any quotes/spaces around SMTP_PASS in Vercel.";
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET") {
    return "Could not reach the mail server. Try SMTP_PORT=465 (or 587) in Vercel and redeploy.";
  }
  return null;
}

async function sendWithFallback(user, pass, mailOptions) {
  const ports = [];
  const configured = Number(process.env.SMTP_PORT);
  if (configured) {
    ports.push(configured);
  } else {
    ports.push(465, 587);
  }

  let lastError;
  for (const port of ports) {
    const transporter = createGmailTransporter(user, pass, port);
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (err) {
      lastError = err;
      console.error(`SMTP send failed on port ${port}:`, err.code, err.response || err.message);
    }
  }
  throw lastError;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, {});
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const user = (process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").replace(/\s/g, "");
  const to = (process.env.CONTACT_TO || "alimentriai@gmail.com").trim();
  const debug = process.env.CONTACT_DEBUG === "1" || process.env.CONTACT_DEBUG === "true";

  if (!user || !pass) {
    return json(res, 503, {
      ok: false,
      error:
        "Email is not configured yet. Set SMTP_USER and SMTP_PASS in Vercel environment variables.",
    });
  }

  let body;
  try {
    body = parseBody(req);
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

  const mailOptions = {
    from: `"Alimentri Website" <${user}>`,
    to,
    replyTo: email,
    subject,
    text,
    html,
  };

  try {
    await sendWithFallback(user, pass, mailOptions);
    return json(res, 200, { ok: true, message: "Thank you — we will be in touch soon." });
  } catch (err) {
    console.error("SMTP error:", err.code, err.response || err.message);
    const hint = smtpHint(err);
    const payload = {
      ok: false,
      error: hint || "Could not send message. Please try again or email us directly.",
    };
    if (debug) {
      payload.debug = {
        code: err.code,
        message: err.message,
        response: err.response,
      };
    }
    return json(res, 500, payload);
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
