# ArtSpace Backend (Bronze)

## Run API
- Development: `npm run backend:dev`
- One-off run: `npm run backend:start`

Default server URL: `http://localhost:4000`

For local HTTPS development, the backend uses the certificates in `certs/` when they exist.
For cloud deployment, the server can fall back to HTTP behind the platform's HTTPS termination.

## Email setup

The backend sends login and registration verification codes and password reset links through SMTP.

Use a real SMTP provider so messages reach actual inboxes. Good free or low-cost options include Gmail SMTP, Outlook/Office365 SMTP, Brevo, SendGrid SMTP, or Mailgun SMTP.

Set these environment variables in `.env` or `.env.local`:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `FRONTEND_URL` for password reset links, for example `https://your-site.netlify.app`

Restart the backend after changing the values.

In production, the backend now requires real SMTP configuration; it no longer falls back to a fake transport.

## Endpoints
- `GET /api/health`
- `GET /api/artworks?page=1&pageSize=5&artist=&category=&search=`
- `GET /api/artworks/:id`
- `POST /api/artworks`
- `PUT /api/artworks/:id`
- `DELETE /api/artworks/:id`
- `GET /api/stats/overview`

## Test + Coverage
- Tests: `npm run test:backend`
- Coverage: `npm run test:backend:coverage`

Coverage report output: `coverage/backend/index.html`

## Notes
- Data is stored in RAM only (array-based in-memory store).
- No database, files, or external persistence layer.
