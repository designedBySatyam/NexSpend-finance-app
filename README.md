# NexSpendFinance

A browser-based finance tracker with authentication, dashboards, insights, budgeting, reminders, and exports.

Now includes:
- Frontend transaction import: CSV + PDF statement support
- Frontend transaction export: password-protected CSV + full PDF + monthly summary PDF
- Backend API (Node/Express) for auth, user data sync, and PDF parsing/generation

## Run Locally

1. Open a terminal in this project root.
2. Start full app from backend (API + frontend static hosting):
   - `cd backend`
   - `npm install`
   - Optional (recommended): copy `.env.example` to `.env` and set your values
     - `copy .env.example .env` (Windows)
     - `cp .env.example .env` (macOS/Linux)
   - Optional (MongoDB): set env vars before start
     - `MONGODB_URI=<your mongodb connection string>`
     - `MONGODB_DB_NAME=nexspend` (optional, default is `nexspend`)
   - Optional (Forgot password email delivery): set Resend env vars before start
     - `RESEND_API_KEY=<your resend api key>`
     - `RESEND_FROM="NexSpend <onboarding@resend.dev>"` (or your verified sender)
     - `RESEND_REPLY_TO=<support@yourdomain.com>` (optional)
     - `APP_DISPLAY_NAME=NexSpend` (optional)
     - `RESET_CODE_TTL_MINUTES=15` (optional)
     - `EMAIL_SEND_TIMEOUT_MS=15000` (optional)
   - `npm start` (runs on `http://localhost:4000`)
3. Open:
   - `http://localhost:4000`

Important:
- Authentication and user data now sync through backend APIs.
- If you were already logged in from an older local-only session, sign out once and sign in again.

Optional split mode (frontend and backend on different ports):
- Start backend as above, then in another terminal start frontend static server:
   - `npx serve frontend`
   - `python -m http.server 5500`
- Open:
   - `http://localhost:3000` for `serve`
   - `http://localhost:5500/frontend` for Python server

Backend URL override (optional):
- By default frontend calls `http://localhost:4000/api`.
- To use another API URL, set `window.NEXSPEND_API_BASE` before `app.js` loads.

## Deploy On Render

Recommended: use the included blueprint file [`render.yaml`](./render.yaml).

1. Push this repo to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select your repository and deploy.

Manual Render Web Service settings (if not using blueprint):
- Environment: `Node`
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Environment Variables:
  - `MONGODB_URI` = your MongoDB connection string
  - `MONGODB_DB_NAME` = `nexspend` (optional)
  - `RESEND_API_KEY`, `RESEND_FROM`
  - `RESEND_REPLY_TO` (optional)
  - `APP_DISPLAY_NAME` (optional), `RESET_CODE_TTL_MINUTES` (optional)
  - `EMAIL_SEND_TIMEOUT_MS` (optional)
  - Important: set only URI as value, for example `mongodb+srv://...`
    - Do not include `MONGODB_URI=` in value
    - Do not wrap value in quotes

Persistent data note:
- Recommended: use MongoDB Atlas with `MONGODB_URI` for persistent cloud data.
- If MongoDB env vars are not set, backend falls back to local file DB.
- On free instances, local file DB data can reset on redeploy/restart.
- For file DB on paid instances, add a disk for `backend/data/db.json`:
  - Mount Path: `/opt/render/project/src/backend/data`
  - Size: `1 GB` (or more)

## Implemented Features

- Authentication:
  - Sign up / Login (backend auth + session token)
  - Change password (in profile modal)
  - Forgot password (reset code flow)
  - Optional PIN lock and unlock flow
- Core finance tracking:
  - Add, edit, delete transactions
  - Income/expense separation
  - Fields: amount, category, date, tags, notes, account
- Categories and tags:
  - Predefined categories
  - Custom category creation/removal
  - Tag-based filters
- Dashboard:
  - Total balance
  - Net worth
  - Monthly income vs expense
  - Today/week/month spend
  - Savings rate
- Data visualization (Chart.js):
  - Pie chart: category spend
  - Bar chart: monthly trends
  - Line chart: running balance
  - Daily spend pattern chart
- Budgeting:
  - Monthly category budgets
  - Progress bars
  - Near-limit and exceeded alerts
- Smart alerts and automation:
  - Bill reminders with due-soon/overdue detection
  - Recurring transaction rules (weekly/monthly auto-entry)
  - Auto-categorization by note keywords
  - Auto transaction detection from pasted bank/SMS/UPI text
  - Insight engine with spending and savings suggestions
- Search and filters:
  - Keyword, category, type, min/max amount
  - Date range and tag filters
- Export and backup:
  - Password-protected CSV transaction export (`.csv.enc`)
  - Password-protected full transactions PDF export
  - CSV bank/account statement import
  - PDF bank/account statement import
  - Password-protected PDF summary export
  - JSON backup and restore
- Backend API:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `POST /api/auth/change-password`
  - `POST /api/auth/forgot-password/request`
  - `POST /api/auth/forgot-password/confirm`
  - `GET /api/user`
  - `PUT /api/user`
  - `POST /api/transactions/import/pdf`
  - `POST /api/transactions/export/csv`
  - `POST /api/transactions/export/pdf`
  - `POST /api/reports/export/summary/pdf`
- UX/UI:
  - Responsive layout
  - Dark mode
  - Quick add floating action button on mobile
- Advanced portfolio touches:
  - Multi-account tracking (wallet/bank/UPI)
  - Currency selection (INR/USD/EUR/GBP)
  - Goal tracking progress

PDF import note:
- Parser works best with machine-readable (text) statements.
- Scanned/image-only PDFs may return fewer or no transactions.
- Password-protected PDFs are supported; the app prompts for password during import.

Protected export notes:
- Protected exports require a password (minimum 4 characters).
- CSV export downloads encrypted files with `.csv.enc` extension.
- To decrypt a protected CSV:
  - `cd backend`
  - `npm run decrypt:csv -- <input.csv.enc> <output.csv> <password>`

Password reset note:
- Forgot password uses a backend-generated reset code and delivers it by email (Resend API).
- Reset codes are stored as hashes server-side and are not returned in API responses.
- Configure Resend env vars for this flow to work in your environment.
- With `onboarding@resend.dev`, Resend only sends to your own account email for testing.
- To send to any user email, verify your own domain in Resend and use that sender in `RESEND_FROM`.

## Data Storage

- Backend is the source of truth for auth and user finance data.
- Frontend keeps a local cached copy for fast rendering.
- Backend storage mode:
  - MongoDB (when `MONGODB_URI` is configured)
  - Local JSON file fallback at `backend/data/db.json` (when MongoDB is not configured)
