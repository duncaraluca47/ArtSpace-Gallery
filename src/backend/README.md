# ArtSpace Backend (Bronze)

## Run API
- Development: `npm run backend:dev`
- One-off run: `npm run backend:start`

Default server URL: `http://localhost:4000`

For local HTTPS development, the backend uses the certificates in `certs/` when they exist.
For cloud deployment, the server can fall back to HTTP behind the platform's HTTPS termination.

## Email setup

The backend sends login and registration verification codes through SMTP.

For Mailtrap:
- Use the SMTP host, port, username, and password shown in your Mailtrap inbox or sandbox settings.
- Put those values into `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in `.env` or `.env.local`.
- Restart the backend after changing the values.

Mailtrap sandbox accounts capture messages inside Mailtrap instead of sending them to real inboxes.

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
