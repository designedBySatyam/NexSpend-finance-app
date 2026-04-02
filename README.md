# Finance Tracker Pro

A browser-based finance tracker with authentication, dashboards, insights, budgeting, reminders, and exports.

## Run Locally

1. Open a terminal in this project root.
2. Start a static server (choose one):
   - `npx serve frontend`
   - `python -m http.server 5500`
3. Open:
   - `http://localhost:3000` for `serve`
   - `http://localhost:5500/frontend` for Python server

## Implemented Features

- Authentication:
  - Sign up / Login (local demo auth)
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
  - Insight engine with spending and savings suggestions
- Search and filters:
  - Keyword, category, type, min/max amount
  - Date range and tag filters
- Export and backup:
  - CSV transaction export
  - PDF summary export
  - JSON backup and restore
- UX/UI:
  - Responsive layout
  - Dark mode
  - Quick add floating action button on mobile
- Advanced portfolio touches:
  - Multi-account tracking (wallet/bank/UPI)
  - Currency selection (INR/USD/EUR/GBP)
  - Goal tracking progress

## Data Storage

- All data is stored in browser `localStorage`.
- This is ideal for demo/portfolio mode.
- For production, add a backend (Node/Express + PostgreSQL/MongoDB + secure auth).
