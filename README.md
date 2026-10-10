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

Never commit real passwords. Use Vercel env vars only.

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add the SMTP environment variables.
4. Deploy.

Or use the CLI: `npx vercel --prod` (after `vercel login`).
