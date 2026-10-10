# Alimentri

Premium marketing site for **Alimentri** — HTML, CSS, and JavaScript, with a Vercel serverless API for contact form email (SMTP).

## Local preview

Static files only (contact form needs Vercel or `vercel dev`):

```bash
npx serve .
```

With API locally:

```bash
npm install
vercel dev
```

## Contact form (SMTP)

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable     | Example / notes                                      |
| ------------ | ---------------------------------------------------- |
| `SMTP_USER`  | `alimentriai@gmail.com`                              |
| `SMTP_PASS`  | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `SMTP_HOST`  | `smtp.gmail.com` (optional)                          |
| `SMTP_PORT`  | `587` (optional)                                     |
| `CONTACT_TO` | `alimentriai@gmail.com` (optional, default above)    |
| `CONTACT_DEBUG` | `true` — include SMTP error details in API response (disable after fixing) |

Never commit real passwords. Use Vercel env vars only.

### Gmail App Password (required)

1. Turn on **2-Step Verification** for `alimentriai@gmail.com`.
2. Open [Google App Passwords](https://myaccount.google.com/apppasswords) → create a password for **Mail**.
3. Copy the 16-character password into Vercel as `SMTP_PASS` (spaces are OK; the API strips them).
4. Set `SMTP_USER` to exactly `alimentriai@gmail.com` (must match the account that owns the app password).
5. Redeploy the project after changing env vars.

If the form returns *Could not send message*, check **Vercel → Project → Logs** for `SMTP error`, or set `CONTACT_DEBUG=true`, redeploy, submit once, then remove `CONTACT_DEBUG`.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add the SMTP environment variables.
4. Deploy.

Or use the CLI: `npx vercel --prod` (after `vercel login`).

## SEO & search ranking

The site includes:

- `robots.txt` and `sitemap.xml` (canonical URL: `https://www.alimentri.com/`)
- Meta description, Open Graph, and Twitter Card tags
- JSON-LD structured data (Organization, WebSite, ProfessionalService, FAQPage)

**After deploy, register the site:**

1. [Google Search Console](https://search.google.com/search-console) — add property `https://www.alimentri.com`, verify ownership, submit `https://www.alimentri.com/sitemap.xml`.
2. [Bing Webmaster Tools](https://www.bing.com/webmasters) — same sitemap URL.
3. Ensure **www** (or apex) redirects consistently in Vercel → Domains (one canonical host).
4. Optional: add Google Analytics or [Plausible](https://plausible.io) for traffic insights.

Update `sitemap.xml` `<lastmod>` when you make meaningful content changes.
