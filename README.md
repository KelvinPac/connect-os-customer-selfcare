# ConnectOS Customer Portal

Self-service portal for ConnectOS (ISP billing) customers. Vue 3 + Vite + Pinia + Vue Router + Tailwind CSS v4. It talks to the existing ConnectOS API (`/api/v1`) and adds no backend of its own.

## Run

```bash
npm install
cp .env.example .env     # VITE_API_PROXY_TARGET -> where the ConnectOS API runs (default http://localhost:5008)
npm run dev              # http://localhost:3000
```

The portal must run on **port 3000** in development: the API's CORS allow-list is `FRONTEND_URL` plus `http://localhost:3000`. Vite proxies `/api` to the API, so the browser never makes a cross-origin call.

Sign in with a customer account (role `CUSTOMER`). Staff accounts are refused with a pointer to the admin console.

### Production

```bash
npm run build            # static files in dist/
```

Either serve `dist/` behind a reverse proxy that forwards `/api` to the API (same-origin, no config), or build with `VITE_API_BASE_URL=https://api.example.com/api/v1` and add the portal's origin as `FRONTEND_URL` in the API's `.env`.

## What's in it

| Page | Uses | Notes |
|---|---|---|
| Sign in / forgot / reset | `POST /auth/login`, `/refresh`, `/forgot-password`, `/reset-password` | Prompts for the 6-digit code when the account has 2FA. Tokens refresh transparently (15-min access token). |
| Overview | `GET /customers/:id`, `/tickets`, `/payments`, wallet | Plan hero, wallet, data allowance (`fup` block), at-risk banners derived from subscription status. |
| My internet | `GET /customers/:id`, `GET /plans` (public), `GET /subscriptions/:id/preview`, `POST /subscriptions/:id/renew` | Renew with a confirmation that shows the exact charge and new billing date. PPPoE login with reveal/copy. |
| Wallet | `GET /customers/:id/wallet`, `POST /payments/mpesa/stkpush`, `GET /payments/:id` | M-Pesa STK push with polling until the callback lands; Paybill instructions using the customer number. |
| Billing | `GET /customers/:id/invoices\|payments\|renewals`, `GET /invoices/:id[/pdf]` | Invoice detail and authenticated PDF download. |
| Usage | `GET /customers/:id/usage` | RADIUS session history (gigaword counters handled), online status, per-day download chart. |
| Support | `/customers/:id/tickets`, `/tickets/*` | Create, reply, mark resolved/close, CSAT rating. |
| Account | `PUT /customers/:id`, `/auth/change-password`, `/auth/2fa/*`, contacts | Only customer-safe fields are sent (see below). |

Source of truth for every call is in [`src/api/index.js`](src/api/index.js); the endpoints come from `ConnectOS/docs/UI_INTEGRATION_GUIDE.md`, `TICKETING_API_GUIDE.md` and `SUBSCRIPTION_PREVIEW_API.md`.

## Behaviour worth knowing

- **Plan changes are tickets.** `POST /subscriptions/:id/change-plan` is an unimplemented stub (500) in the API, so "Request this plan" opens an `UPGRADE_DOWNGRADE` ticket.
- **Activation is staff-only.** Customers can renew but not activate; a `PENDING` subscription shows an "awaiting activation" message.
- **Top-ups reactivate instantly.** After a successful top-up the portal refetches the account; the API has already retried any `EXPIRED`/`GRACE_PERIOD` subscription.
- **M-Pesa** needs real Daraja credentials and a public callback URL on the API; until then `stkpush` returns 500 and the portal says M-Pesa is temporarily unavailable. Set `VITE_MPESA_PAYBILL` to show the Paybill number.
- **Dates** come back as `DD-MM-YYYY HH:mm:ss` in the company timezone; `src/utils/format.js` parses them.
- **Not built** because the API has no customer-facing endpoint: cancelling a subscription, changing the auto-renew flag (admin-only `PUT /subscriptions/:id`), forgot-password email delivery (API only logs the link today), self-registration.
