# Amir Mobile Store

A modern RTL Persian e-commerce storefront for flagship smartphones, tablets, smartwatches, audio gear, and charging accessories, paired with a production Express authentication and transactional email API.

The application uses a split-origin architecture:
- **Frontend**: Static React 19 + TypeScript + Tailwind CSS v4 bundle hosted on **GitHub Pages** behind **ArvanCloud CDN** (`https://amir-mobile-store.codenameamir.ir`).
- **Backend API**: Express server (`server.ts`) hosted on **Render** (`https://api.codenameamir.ir`) handling `HttpOnly` cookie sessions, two-factor authentication (2FA), and transactional emails via **Resend**.
- **Database**: **Supabase PostgreSQL** storing storefront catalog/orders alongside service-role-protected user accounts (`app_users`) and OTP challenges (`auth_otp_challenges`).

---

## Key Features

### Storefront & Shopping Experience
- **Home & Live Search (`#/`)**: Hero showcase, flash deals, category shelves, brand filters, recently viewed items, and instant autocomplete across Persian/English names, brands, and chipsets.
- **Smart Catalog (`#/catalog`)**: Simultaneous filtering by category, brand, price range, stock availability, express delivery, discounts, storage, RAM, and color, with sorting options.
- **Product Detail Page (`#/product/:slug`)**: Interactive color and storage variant pricing, Amir Care+ accidental damage coverage calculation, monthly installment preview, technical specs, and buyer reviews backed by Supabase (`product_reviews`).
- **Product Comparison (`#/compare`)**: Side-by-side comparison for up to 3 devices with a differences-only toggle.
- **Installments & Trade-In (`#/installments`)**: Interactive down-payment and term calculator with estimated trade-in deduction.
- **Cart, Checkout & Order Tracking (`#/cart`, `#/checkout`, `#/tracking`)**: Dynamic coupon validation (`AMIR-OFF`, `VIP-10`), Iranian mobile/postal-code validation, printable invoice (`#/order-confirmed/:code`), and live 4-step order tracking.

### Authentication & Account Management (`#/account`)
- **Email-Verified Registration**: Sign up with full name, email, optional mobile number, and password, verified via a 6-digit OTP email sent through Resend.
- **Sign-In Methods**:
  - **Password Login**: Secure `scrypt` password hashing with timing-safe verification.
  - **One-Time Email Code (OTP)**: Passwordless sign-in restricted strictly to existing registered accounts (unregistered emails cannot auto-create accounts during login).
  - **Two-Factor Authentication (2FA)**: Optional per-account email 2FA. When enabled, signing in requires password verification first, followed by a signed 2FA challenge token and a 6-digit OTP email before issuing a session cookie. Passwordless OTP bypass is blocked while 2FA is active.
- **Password Reset & Email Change**: Verified via 6-digit OTP codes with Resend security alert notifications.
- **Account Dashboard**: Profile editing, saved delivery addresses (auto-filled during checkout), order history, wishlist, stock alerts, password/2FA controls, and single-device or all-device session revocation.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React
- **Backend**: Node.js 22 (native `.ts` execution), Express 4, Resend SDK
- **Database**: Supabase (PostgreSQL + Row Level Security)
- **CI/CD & Hosting**: GitHub Actions + GitHub Pages + ArvanCloud CDN (Frontend) & Render (Backend)

---

## Local Development & Testing

### Prerequisites
- Node.js `>=22.18.0` (pinned to `22.23.2` in `.node-version`)
- npm

### Setup & Run
```bash
npm install
cp .env.example .env
npm run dev
```
The local development server runs at `http://localhost:3000`.

### Automated Tests & Checks
```bash
# Storefront pricing, coupons, installments & filter logic
npx --yes tsx --test src/utils/storeLogic.test.ts

# Auth & profile form validation rules
npx --yes tsx --test src/utils/authLogic.test.ts

# Production config guards, Supabase adapter, CORS, HTTPS cookies, auth & 2FA HTTP flows
npx --yes tsx --test server/authFlow.test.ts

# TypeScript check & production Vite build
npm run lint
npm run build
```

---

## Database Setup (Supabase)

1. Create a project in [Supabase](https://supabase.com) and run the full contents of [`supabase/schema.sql`](supabase/schema.sql) in the **SQL Editor**.
   - The script is idempotent and creates both public storefront tables (`products`, `orders`, `coupons`, `product_reviews`, `support_tickets`, `store_settings`, `newsletter_subscribers`) and backend-only auth tables (`app_users`, `auth_otp_challenges`).
   - RLS is enabled with **no `anon` policies** on `app_users` and `auth_otp_challenges`, ensuring password hashes and OTP hashes are accessible only via the backend `SUPABASE_SERVICE_ROLE_KEY`.
2. *(Optional)* Run [`supabase/seed_products.sql`](supabase/seed_products.sql) to populate the `public.products` catalog table.
3. Copy your credentials from **Project Settings → API**:
   - `Project URL` → `VITE_SUPABASE_URL` & `SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY` (**backend only**)

---

## Production Deployment

### 1. Backend API on Render (`https://api.codenameamir.ir`)
Render configuration is provided in [`render.yaml`](render.yaml) and [`.node-version`](.node-version):
- **Runtime**: Node `22.23.2`
- **Build Command**:
  ```bash
  if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
  ```
- **Start Command**:
  ```bash
  npm start
  ```
- **Health Check Path**: `/api/health`

Required Render Environment Variables:
| Variable | Value / Notes |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.23.2` |
| `CORS_ORIGIN` | `https://amir-mobile-store.codenameamir.ir` (comma-separated if allowing additional origins) |
| `AUTH_SESSION_SECRET` | Strong random secret, at least 32 chars (`openssl rand -hex 32`) |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase `service_role` key |
| `RESEND_API_KEY` | Your Resend API key |
| `RESEND_FROM_EMAIL` | Verified domain sender (e.g. `Amir Mobile <auth@codenameamir.ir>`) |

> Note: Express configures `trust proxy`, `SameSite=None; Secure; HttpOnly` session cookies, and fails startup if `AUTH_SESSION_SECRET`, `CORS_ORIGIN`, or Supabase service credentials are missing in production.

### 2. Frontend on GitHub Pages (`https://amir-mobile-store.codenameamir.ir`)
Configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
1. In GitHub **Settings → Secrets and variables → Actions**:
   - **Secrets**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - **Variables**: `VITE_API_URL` = `https://api.codenameamir.ir`
   - Never expose `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `AUTH_SESSION_SECRET` in frontend variables or build output.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.

### 3. DNS & ArvanCloud CDN
- **`amir-mobile-store.codenameamir.ir`**: `CNAME` pointing to `<username>.github.io` with ArvanCloud proxy enabled and SSL mode set to **Full (Strict)**.
- **`api.codenameamir.ir`**: Add as a Custom Domain in Render and point a `CNAME` record in ArvanCloud DNS to `<your-service>.onrender.com` with **Proxy disabled (DNS Only / gray cloud)** so Render handles TLS directly and `Set-Cookie` headers pass cleanly without CDN caching interference.
- **Resend DNS**: Verify DKIM and SPF records for your sending domain so verification and 2FA emails deliver to all customer addresses.
