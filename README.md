# Trusted Systems Store

Production-grade eCommerce app for **shop.trustedsystems.co.ke** — Next.js 15 (App Router, TypeScript, Tailwind CSS) + PostgreSQL, deployed as Docker containers behind a Cloudflare Tunnel. No public ports are opened on the VPS.

## What is included

- **Storefront:** server-rendered home, category tree (with parent/child categories), searchable/sortable/paginated catalogue, product detail with variants/options/images/active promotions and verified-purchase reviews.
- **Cart & checkout:** guest cart in a signed HttpOnly cookie, merged into the database cart on login; multi-step checkout; one active cart per customer enforced by the exact schema's partial unique index.
- **Money:** every price is `decimal(10,2)` in PostgreSQL and all arithmetic is done in integer cents on the server. No floating point is used for totals.
- **Transactional checkout:** one ACID transaction locks cart lines and variants `FOR UPDATE`, re-prices from the database, applies active promotions (`Percentage` / `Fixed` via `promotion_product`), conditionally decrements stock, snapshots product name, SKU, option summary, unit price and discount onto `order_line`, copies shipping address + method price onto `customer_order`, and writes the payment row before committing. The charge happens after commit; webhooks finalise the state idempotently.
- **Payments:** provider interface with Stripe and a signed mock provider. Only `provider_token` is stored — never card numbers. Idempotency keys are required on checkout and forwarded to Stripe.
- **Accounts:** scrypt password hashes, signed session cookies (Secure behind Cloudflare), profile, addresses, tokenised payment methods, order history and one review per purchased order line (rating 1–5).
- **Ops:** multi-stage standalone Dockerfile, `docker-compose.yml` (Postgres + migrator + app + cloudflared), `deploy.sh`, `update.sh`, idempotent `db/schema.sql` + seed, `/api/health`.

## Quick start (local development)

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL to a local PostgreSQL database and SESSION_SECRET to a random value.
npm run db:setup       # applies db/schema.sql and seeds reference data + catalogue
npm run dev            # http://localhost:3000
```

Demo login: **demo@trustedsystems.co.ke / Demo123!**

## Production deployment on an Ubuntu VPS (single command)

```bash
git clone <your-repo-url> store && cd store
chmod +x deploy.sh && ./deploy.sh
```

`deploy.sh` will:

1. Install Docker + the Compose plugin if missing.
2. Create `.env` from `.env.example`, generate a strong `POSTGRES_PASSWORD` and `SESSION_SECRET`, and keep `DATABASE_URL` in sync. It asks for your Cloudflare Tunnel token (blank = deploy without a tunnel for now).
3. Build the images, start PostgreSQL, apply the exact schema and idempotent seed, then start the app and cloudflared.
4. Wait for `/api/health` and print the site URL and demo credentials.

Update later with:

```bash
chmod +x update.sh && ./update.sh
```

`update.sh` pulls the current branch with `--ff-only`, builds only changed images, applies schema/seed idempotently, restarts the needed services via `docker compose up -d --build`, and prunes dangling images.

### Cloudflare Tunnel setup

1. In Cloudflare Zero Trust → **Network → Tunnels**, create a tunnel and copy its token.
2. Add a **Public Hostname**: `shop.trustedsystems.co.ke` → HTTP → `app:3000` (the service name is `app` on the Compose network).
3. Set `TUNNEL_TOKEN` in `.env` and set `APP_URL=https://shop.trustedsystems.co.ke`.
4. Restart: `docker compose up -d --build`.

The app reads `X-Forwarded-Proto` and `X-Forwarded-Host` for cookies, redirects and metadata, so HTTPS works correctly behind the tunnel. PostgreSQL is never published; only cloudflared makes an outbound connection.

### Stripe (production payments)

1. Set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_...` and `STRIPE_WEBHOOK_SECRET=whsec_...` in `.env`.
2. Add webhook endpoint `https://shop.trustedsystems.co.ke/api/payments/webhook` for:
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
3. Generate `pm_...` payment-method tokens with Stripe.js on the client (the checkout form accepts the token; no raw card data touches this app). For local demos, leave `PAYMENT_PROVIDER=mock` and use `tok_demo_4242`.

The currency code in `src/lib/checkout.ts` is `kes` (KES). If your Stripe account presents a different currency, change the `currency` value in that one place.

## Configuration

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL container credentials |
| `DATABASE_URL` | Internal pooled connection string (`@db:5432/store` in Docker) |
| `APP_URL` | Canonical public origin |
| `SESSION_SECRET` | HMAC key for session/cart cookies and mock webhook signatures (`openssl rand -base64 48`) |
| `PAYMENT_PROVIDER` | `mock` (demo) or `stripe` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe credentials |
| `TUNNEL_TOKEN` | Cloudflare Tunnel token |

## Database integrity notes

`db/schema.sql` is the exact schema supplied in the specification, including all 21 tables, comments, foreign keys, the four named unique indexes and the `ck_review_rating` check. The application never adds or alters tables. The partial unique indexes enforce one default address, one default payment method and one cart per customer. `scripts/db-migrate.ts` uses an advisory lock and skips if the schema already exists; `scripts/db-seed.ts` uses natural keys/SKUs and `ON CONFLICT DO NOTHING`, so both are safe to run on every deploy.

## Useful commands

```bash
docker compose ps                       # service status
docker compose logs -f app cloudflared  # live logs
docker compose exec db psql -U store -d store -c '\dt'
npm run typecheck                       # static type check
npm run build                           # production build
```

## Project layout

```
db/schema.sql            exact PostgreSQL schema
scripts/db-migrate.ts    advisory-locked, non-destructive migration runner
scripts/db-seed.ts       idempotent lookup data, catalogue, promotions, demo account
src/lib/db.ts            pg.Pool + withTransaction helper
src/lib/money.ts         integer-cent decimal arithmetic
src/lib/auth.ts          scrypt hashing + signed session cookies
src/lib/catalog.ts       category tree, product queries, active-promotion SQL
src/lib/cart.ts          guest/DB cart, snapshot pricing
src/lib/checkout.ts      ACID checkout + idempotent payment/webhook transitions
src/lib/payments/*       Stripe and mock providers
src/app                  App Router pages and API route handlers
Dockerfile               deps → builder → standalone runner → migrator
docker-compose.yml       db, migrate, app, cloudflared, optional app-local
```

## Troubleshooting a Cloudflare 502

The app is healthy if `docker compose ps` shows `app` as `Healthy` and `docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>console.log(r.status))"` prints `200`. A 502 at the Cloudflare edge then means the tunnel cannot reach the origin. Run `./diagnose.sh` (read-only) and check:

1. Zero Trust → Networks → Tunnels → **your tunnel** → Public Hostname:
   - Hostname: `shop.trustedsystems.co.ke`
   - Service Type: **HTTP** (not HTTPS)
   - URL: **`app:3000`** (not `localhost:3000`, not `127.0.0.1:3000`)
2. DNS for `shop.trustedsystems.co.ke` is a proxied CNAME to `<tunnel-id>.cfargotunnel.com`, created by that Public Hostname. Remove any manually created A/AAAA record.
3. `TUNNEL_TOKEN` belongs to that tunnel. After changing it: `docker compose up -d --force-recreate cloudflared`.
4. Test from outside: `curl -i https://shop.trustedsystems.co.ke/api/health` → `HTTP/2 200` with `{"status":"ok","database":true}`.

If you exposed the tunnel token anywhere, rotate it in Zero Trust and replace `TUNNEL_TOKEN` in `.env`.

## Admin dashboard

Access is allowlist-based because the supplied schema has no role column: an account can open `/admin` only when its email is listed in `ADMIN_EMAILS`. Every admin page and API route checks this on the server.

1. Add your email to `.env` (comma-separate multiple emails):
   ```bash
   ADMIN_EMAILS=you@example.com
   ```
2. Create that customer account (or reset an existing customer's password) and hash the password with scrypt:
   ```bash
   docker compose run --rm migrate npm run admin:create -- you@example.com 'StrongPassword123'
   ```
3. Recreate the app so it picks up the changed env:
   ```bash
   docker compose up -d --force-recreate app
   ```
4. Sign in at `/login` with that email, then open `https://shop.trustedsystems.co.ke/admin`.

The dashboard provides:
- **Overview** — order counts, booked revenue, customers, low-stock variants, active promotions, recent orders.
- **Products & stock** — search products, edit names/brands/descriptions/categories, and change variant prices and stock levels.
- **Orders** — filter by status, inspect line items and shipping/payment details, and mark orders Placed, Shipped, Delivered or Cancelled. Cancelling returns stock once and records the payment as refunded; Paid is only set by a confirmed payment event.
- **Promotions** — create, edit and delete `Percentage` / `Fixed` promotions and their product links.
- **Categories** — create and rename categories, set top-level parents (cycle protection is enforced).

The seeded demo account is **not** an admin by default. Never expose the admin password or the `ADMIN_EMAILS` list publicly.
