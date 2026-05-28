# Authentication, Tokens and Sessions

This project issues JWT access and refresh tokens and enforces permissions using the token payload. This document explains where to find the implementation and how to demonstrate token generation for different roles and session behavior.

Key files

- `src/utils/jwt.ts` — token creation and verification helpers. Tokens include `role` and `permissions` in the payload.
- `src/routes/authRoutes.ts` — issues tokens on login (`issueSessionResponse`) and sets the refresh token as an HTTP-only cookie.
- `src/middleware/requireAuth.ts` — validates access tokens and enforces permissions via `requirePermission`.
- `src/context/AuthContext.tsx` — client-side session management: stores access tokens in-memory, refreshes them from the refresh cookie, and enforces inactivity logout (`INACTIVITY_TIMEOUT_MS`).

How tokens encode permissions

1. The server loads the user's role and permissions from the database and builds a token payload containing `id`, `username`, `email`, `role`, and `permissions` before signing it.
2. `generateAccessToken` and `generateRefreshToken` in `src/utils/jwt.ts` sign the payload and set expiration (`JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`).

How sessions are managed

- Access tokens are stored in-memory on the client (not persisted) via `src/app/services/authToken.ts`.
- The refresh token is set as an `httpOnly` cookie by the server (path `/api/auth`) and used by the client to request fresh access tokens at `POST /api/auth/refresh`.
- The front-end sets an inactivity timer (`INACTIVITY_TIMEOUT_MS`) and automatically logs out the user after that period of inactivity.

Demonstration: generate example tokens for different permission schemes

Use the helper script `scripts/generate-tokens.ts` to sign tokens for ad-hoc demonstration. It uses the same signing key and expiry settings as the server.

Run locally (uses `tsx`):

```bash
npx tsx scripts/generate-tokens.ts --role user
npx tsx scripts/generate-tokens.ts --role admin
```

The script prints an `accessToken` and a `refreshToken` you can paste into API clients to exercise protected routes. Example protected endpoints that check permissions:

- `POST /api/artworks` requires `artwork:create` permission.
- `DELETE /api/artworks/:id` requires `artwork:delete` permission.

Notes

- Do NOT use generated tokens from this script in production — it's only for demos and local testing.
- If you prefer an environment flag to enable development fallback behavior, add `SHOW_DEV_FALLBACK=true` and gate code paths accordingly.

Files changed/added for demo

- `docs/AUTHENTICATION.md` — this document
- `scripts/generate-tokens.ts` — token generation helper
