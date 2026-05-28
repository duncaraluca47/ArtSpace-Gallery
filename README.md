
  # Art Gallery Platform UI

  This is a code bundle for Art Gallery Platform UI. The original project is available at https://www.figma.com/design/TCbbpSrQUdQMnNNXOFxFPW/Art-Gallery-Platform-UI.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Bronze Backend (REST API)

  Run `npm run backend:dev` to start the backend in watch mode.

  Run `npm run backend:start` to start the backend once.

  Backend URL: `https://localhost:4443`

  For local development on Windows or macOS/Linux, add `VITE_BACKEND_URL=https://localhost:4443` to `.env.local` so the frontend talks to the backend during `npm run dev`.

  For cross-machine deployment, set `VITE_BACKEND_URL` before building the client so the frontend points to your backend server (for example `https://<server-ip>:4443`).

  ## Easiest exam deployment

  The simplest free setup is:
  - Frontend on Netlify
  - Backend on Render

  Suggested flow:
  1. Deploy the backend first.
     - Start command: `npm run backend:start`
     - Set `DATABASE_URL`.
     - Set `CORS_ORIGIN` to your frontend URL, for example `https://your-site.netlify.app`.
  2. Deploy the frontend as a static site.
     - Build command: `npm run build:client`
     - Publish directory: `dist`
     - Set `VITE_BACKEND_URL` to your backend URL, for example `https://your-backend.onrender.com`.
  3. Use the public HTTPS URLs from both services in the exam.

  Notes:
  - The backend now runs with local HTTPS only when the certificate files in `certs/` exist.
  - Cloud hosts usually provide HTTPS automatically, so you do not need to upload your own certificate for the host platform.
  - If the exam specifically checks for Let’s Encrypt, connect a custom domain to the host and use the host’s HTTPS endpoint.

  ### Email delivery with Mailtrap

  The app already reads standard SMTP settings from `.env` or `.env.local`.

  To use Mailtrap:
  - Create a Mailtrap inbox or sandbox in the Mailtrap dashboard.
  - Copy the SMTP host, port, username, and password from Mailtrap.
  - Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` in `.env.local` or `.env`.
  - Restart the backend after updating the values.

  If you are using the Mailtrap sandbox, the messages are captured in Mailtrap instead of being delivered to real inboxes.

  ### Backend tests and coverage

  Run `npm run test:backend` to execute backend API tests.

  Run `npm run test:backend:coverage` to generate backend coverage.

  Coverage report: `coverage/backend/index.html`

  ### Benchmark and stack justification

  See `guidelines/BronzeBackendBenchmark.md`.
  