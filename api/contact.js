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
  const projectType = String(body.projectType || "").trim();
  const timeline = String(body.timeline || "").trim();
  const budget = String(body.budget || "").trim();
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
  const receivedAt = new Date().toUTCString();
  const text = [
    "New contact form submission — alimentri.com",
    "",
    `Name:    ${name}`,
    `Email:   ${email}`,
    company ? `Company: ${company}` : null,
    projectType ? `Need:     ${projectType}` : null,
    timeline ? `Timeline: ${timeline}` : null,
    budget ? `Budget:   ${budget}` : null,
    "",
    "Message:",
    message,
    "",
    `Received: ${receivedAt}`,
    `Reply to: ${email}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = buildContactEmailHtml({
    name,
    email,
    company,
    projectType,
    timeline,
    budget,
    message,
    receivedAt,
  });

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

function buildContactEmailHtml({
  name,
  email,
  company,
  projectType,
  timeline,
  budget,
  message,
  receivedAt,
}) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");
  const replySubject = encodeURIComponent(`Re: Your message to Alimentri`);
  const mailtoEmail = encodeURIComponent(email);
  const mailtoReply = `mailto:${mailtoEmail}?subject=${replySubject}`;

  function fieldRow(label, value) {
    if (!value) return "";
    return `
          <tr>
            <td style="padding:14px 20px;border-top:1px solid #e8ecf4;width:120px;vertical-align:top;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">${label}</td>
            <td style="padding:14px 20px;border-top:1px solid #e8ecf4;font-size:15px;color:#0f172a;">${escapeHtml(value)}</td>
          </tr>`;
  }

  const extraRows =
    fieldRow("Company", company) +
    fieldRow("Need", projectType) +
    fieldRow("Timeline", timeline) +
    fieldRow("Budget", budget);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Alimentri contact</title>
</head>
<body style="margin:0;padding:0;background-color:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#eef1f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 32px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0e121c 0%,#1a2332 100%);padding:28px 24px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:44px;vertical-align:middle;">
                          <img src="https://www.alimentri.com/images/logo-128.png" alt="Alimentri" width="48" height="48" style="display:block;" />
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <div style="font-size:18px;font-weight:700;color:#f8fafc;letter-spacing:-0.02em;">Alimentri</div>
                          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;margin-top:2px;">Website contact</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(45,212,191,0.15);border:1px solid rgba(45,212,191,0.35);font-size:11px;font-weight:600;color:#5eead4;letter-spacing:0.04em;">New inquiry</span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:15px;line-height:1.5;color:#cbd5e1;">Someone submitted the contact form on <a href="https://www.alimentri.com" style="color:#2dd4bf;text-decoration:none;font-weight:600;">alimentri.com</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:14px 20px;width:120px;vertical-align:top;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Name</td>
                  <td style="padding:14px 20px;font-size:15px;font-weight:600;color:#0f172a;">${safeName}</td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;border-top:1px solid #e8ecf4;width:120px;vertical-align:top;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Email</td>
                  <td style="padding:14px 20px;border-top:1px solid #e8ecf4;font-size:15px;">
                    <a href="mailto:${mailtoEmail}" style="color:#0d9488;text-decoration:none;font-weight:500;">${safeEmail}</a>
                  </td>
                </tr>
                ${extraRows}
                <tr>
                  <td colspan="2" style="padding:20px 20px 8px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;">Message</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:0 20px 24px;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #14b8a6;border-radius:0 10px 10px 0;padding:16px 18px;font-size:15px;line-height:1.6;color:#334155;">${safeMessage}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;text-align:center;">
              <a href="${mailtoReply}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#14b8a6,#2dd4bf);color:#042f2e;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;box-shadow:0 4px 14px rgba(20,184,166,0.35);">Reply to ${safeName}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e8ecf4;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;">Received ${escapeHtml(receivedAt)} (UTC)</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="https://www.alimentri.com" style="color:#64748b;text-decoration:underline;">alimentri.com</a>
                · IT Software · Cloud · AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
