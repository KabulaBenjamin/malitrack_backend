# malitrack_backend

Node.js + Express + MongoDB (Mongoose) REST API for MaliTrack — personal finance,
debt, and farm business tracking.

## Requirements
- Node.js 18+
- MongoDB (local install or a MongoDB Atlas connection string)

## Setup
```bash
cd malitrack_backend
cp .env.example .env
# edit .env: set MONGO_URI and a strong JWT_SECRET
npm install
npm run dev
```
API runs on **http://localhost:5000** by default (`PORT` in `.env`).

## Environment variables (`.env`)
| Variable | Description |
|---|---|
| `PORT` | Port the API listens on (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens — set a long random value, never commit it |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `30d` |

## Project structure
```
malitrack_backend/
  config/db.js          MongoDB connection
  middleware/auth.js     JWT auth middleware (protect)
  models/                Mongoose schemas: User, Account, Debt, Transaction, PriceItem
  routes/
    auth.js               register, login, set-pin, verify-pin
    accounts.js            CRUD for cash/bank/M-Pesa accounts
    debts.js                CRUD, payment/token logging, payoff plan (snowball/avalanche)
    transactions.js          cash + in-kind transactions, sale conversion
    dashboard.js              summary stats (balance, debt, net worth, cash flow)
    priceitems.js              price-reference table for in-kind valuation
    business.js                  business/farm ledger + P&L summary
    mpesa.js                     M-Pesa PDF statement import
    reports.js                    PDF report generation (statement, debt summary, P&L)
  server.js               app entry point, route wiring
```

## API overview
All routes except `/api/auth/register` and `/api/auth/login` require a Bearer token:
`Authorization: Bearer <token>`

### Auth
- `POST /api/auth/register` — { name, email, password }
- `POST /api/auth/login` — { email, password }
- `POST /api/auth/set-pin` — { pin } — sets an optional app-lock PIN
- `POST /api/auth/verify-pin` — { pin }

### Accounts
- `GET /api/accounts`
- `POST /api/accounts` — { name, type, balance }
- `PUT /api/accounts/:id`
- `DELETE /api/accounts/:id`

### Debts
- `GET /api/debts`
- `POST /api/debts` — { lender, debtType: "standard"|"paygo", principal, interestRate, minimumPayment, scheduleFrequency, dueDate }
- `PUT /api/debts/:id`
- `POST /api/debts/:id/payments` — { amount, note, date } — logs a payment or PAYGO token top-up, reduces balance
- `DELETE /api/debts/:id`
- `GET /api/debts/payoff-plan/:strategy` — `snowball` or `avalanche`; PAYGO/solar debts are excluded from the fixed order and returned separately

### Transactions
- `GET /api/transactions` — filters: `category`, `type`, `source`, `from`, `to`
- `POST /api/transactions` — cash types (`income`, `expense`, `transfer`, `debt_payment`) or `in_kind` (item, quantity, unit — value auto-calculated from the price list if `amount` is omitted)
- `POST /api/transactions/:id/convert-to-sale` — { account, amount } — links an in-kind entry to a real cash sale
- `DELETE /api/transactions/:id`

### Dashboard
- `GET /api/dashboard/summary` — total balance, total debt, net worth, this month's income/expense/cash flow

### Price list (in-kind valuation)
- `GET /api/price-items`
- `POST /api/price-items` — { name, unit, unitValue } — upserts by name
- `PUT /api/price-items/:id`
- `DELETE /api/price-items/:id`

### Business ledger
- `GET /api/business/ledger` — filters: `from`, `to`
- `GET /api/business/summary` — cash income/expense, net profit, in-kind value produced/sold/unsold

### M-Pesa import
- `POST /api/mpesa/import` — multipart form: `file` (PDF), `account` (account id). Best-effort regex parsing of the standard M-Pesa statement layout; returns `importedCount` and any lines it couldn't parse.

### Reports (PDF)
- `GET /api/reports/monthly-statement?month=&year=`
- `GET /api/reports/debt-summary`
- `GET /api/reports/business-pnl?from=&to=`

## Security notes
- Passwords hashed with bcrypt; all protected routes require a valid JWT.
- PIN lock is optional and separate from login — set it via `/api/auth/set-pin`.
- Always set a strong, unique `JWT_SECRET` before deploying, and never commit `.env`.
- M-Pesa PDF parsing is best-effort; spot-check imported totals against the real statement.
