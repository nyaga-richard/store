# Trusted Systems Store

Production-grade eCommerce app for **shop.trustedsystems.co.ke** — Next.js 15 (App Router, TypeScript, Tailwind CSS) + PostgreSQL, deployed as Docker containers behind a Cloudflare Tunnel. No public ports are opened on the VPS.

## What is included

- **Storefront:** server-rendered home, category tree (with parent/child categories), searchable/sortable/paginated catalogue, product detail with variants/options/images/active promotions and verified-purchase reviews.
- **Cart & checkout:** guest cart in a signed HttpOnly cookie, merged into the database cart on login; multi-step checkout; one active cart per customer enforced by the exact schema's partial unique index.
- **Money:** every price is `decimal(10,2)` in PostgreSQL and all arithmetic is done in integer cents on the server. No floating point is used for totals.
- **Transactional checkout:** one ACID transaction locks cart lines and variants `FOR UPDATE`, re-prices from the database, applies active promotions (`Percentage` / `Fixed` via `promotion_product`), conditionally decrements stock, snapshots product name, SKU, option summary, unit price and discount onto `order_line`, copies shipping address + method price onto `customer_order`, and writes the payment row before committing. The charge happens after commit; webhooks finalise the state idempotently.
- **Payments:** admin-configurable Stripe card checkout (customers enter card details only in Stripe's own card field) plus M-Pesa STK push. Only provider tokens are stored — never card numbers. Idempotency keys are required on checkout and forwarded to Stripe.
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

### Payment configuration

Owners and admins configure gateways in `/admin/payments`. Values entered there override the `.env` seed values without a rebuild. Secret keys are masked in the UI and never sent to the browser; only the Stripe publishable key and the enabled flags are public via `/api/payments/config`.

**Stripe cards:** set Card provider to `Stripe`, enable it, and enter the publishable key, secret key and webhook secret. Customers see Stripe's hosted card field and enter only card number, expiry and CVC — the app receives just a `pm_...` token. No card brand/last-four/expiry fields are filled in by the customer. Register the webhook `https://shop.trustedsystems.co.ke/api/payments/webhook` for `payment_intent.succeeded`, `payment_intent.payment_failed` and `charge.refunded`.

**M-Pesa:** enable M-Pesa and enter the Daraja consumer key/secret, shortcode and passkey. Select `Sandbox` or `Production`. Register `https://shop.trustedsystems.co.ke/api/payments/mpesa/callback?secret=<callback secret>` as the STK callback URL. Customers choose M-Pesa at checkout, enter their phone number and approve the STK push on their phone; the callback finalises the payment. M-Pesa bills whole shillings, so orders with cents must be paid by card.

For local demos, leave Card provider on `Mock` and use `tok_demo_4242`. The currency code is `kes` (KES).

## Configuration

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | PostgreSQL container credentials |
| `DATABASE_URL` | Internal pooled connection string (`@db:5432/store` in Docker) |
| `APP_URL` | Canonical public origin |
| `SESSION_SECRET` | HMAC key for session/cart cookies and mock webhook signatures (`openssl rand -base64 48`) |
| `PAYMENT_PROVIDER`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Initial card gateway settings; editable in `/admin/payments` |
| `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_ENVIRONMENT`, `MPESA_CALLBACK_SECRET` | Initial M-Pesa settings; editable in `/admin/payments` |
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
db/schema.sql            exact PostgreSQL schema (unchanged)
db/extensions.sql        idempotent staff/supplier/purchase + product.is_active extension
scripts/db-migrate.ts    advisory-locked, non-destructive base migration
scripts/db-migrate-extensions.ts  idempotent extension migration
scripts/db-seed.ts       idempotent lookup data, catalogue, promotions, suppliers, demo account
scripts/create-staff.ts  bootstrap owner/admin/manager/staff accounts
src/lib/db.ts            pg.Pool + withTransaction helper
src/lib/money.ts         integer-cent decimal arithmetic
src/lib/auth.ts          scrypt hashing + signed session cookies
src/lib/catalog.ts       category tree, product queries, active-promotion SQL
src/lib/cart.ts          guest/DB cart, snapshot pricing
src/lib/checkout.ts      ACID checkout + idempotent payment/webhook transitions
src/lib/payments/*       Stripe, M-Pesa and mock providers
src/lib/payment-config.ts  Admin-editable gateway credentials
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

## Extended backoffice workflow

The original `db/schema.sql` remains the exact 21-table specification. A second, idempotent migration `db/extensions.sql` is applied by `npm run db:setup` (and therefore by `deploy.sh` / `update.sh`). It adds:

- `product.is_active` — unpublish products without destroying order history.
- `staff_user` — staff accounts with `owner`, `admin`, `manager` and `staff` roles.
- `supplier`, `purchase_order`, `purchase_order_line` — supplier purchasing and stock receipts.
- `site_setting` — editable storefront name, announcement, contact details and delivery copy.

All original tables, columns, foreign keys and constraints are unchanged.

### Staff accounts and roles

Backoffice access accepts either an `ADMIN_EMAILS` customer (treated as owner) or a staff account from `/staff/login`.

```bash
docker compose run --rm migrate npm run staff:create -- owner@example.com 'StrongPassword123' owner
docker compose run --rm migrate npm run staff:create -- manager@example.com 'StrongPassword123' manager
```

| Capability | owner | admin | manager | staff |
| --- | --- | --- | --- | --- |
| View dashboard / orders | ✓ | ✓ | ✓ | ✓ |
| Products, promotions, categories | ✓ | ✓ | ✓ | ✓ |
| Customers, suppliers, purchases | ✓ | ✓ | ✓ | — |
| Manage staff | ✓ | ✓ | — | — |
| Delete staff, grant owner, delete products/customers/suppliers | ✓ | — | — | — |

The last active owner cannot be demoted, disabled or deleted, and nobody can disable or change their own role.

### Product lifecycle

- **Create:** `/admin/products/new` creates the product, first variant, category links and optional image in one transaction.
- **Edit:** change name, brand, description, categories, variant prices and stock levels.
- **Remove from store:** uncheck “Visible in storefront”. Hidden products disappear from the catalogue and product pages, and checkout rejects any hidden item already in a cart. Order history is preserved and the product can be restored.
- **Delete permanently:** only for products with no placed-order history. The API refuses deletion once the product has sold, so the financial trail stays intact.

### Customers

Search and add customers, edit names/email/phone, reset passwords and delete customers who have no order history. Customers with orders cannot be deleted; their history remains intact.

### Suppliers and purchases

1. Add a supplier under `/admin/suppliers` (a few sample suppliers are seeded).
2. Open `/admin/purchases`, choose the supplier, add one or more variants with quantities and unit costs, and create the purchase order.
3. Open the order and click **Receive all into stock**. This transaction locks each variant, adds the outstanding quantity to `qty_in_stock`, marks lines as received and sets the order to `Received`. Cancel is available while the order is `Draft` or `Ordered`.

Purchase costs are stored with exact `decimal` arithmetic. Receiving stock does not alter customer-facing prices.

### Product images

The create and edit forms accept either an image URL or a direct upload (JPG, PNG, WebP or GIF, up to 5 MB). Uploads are type- and magic-byte-checked, stored on the persistent `uploads` Docker volume at `/app/.data/uploads`, and served through `/api/uploads/<filename>` so they keep working after a container rebuild. Catalogue, product detail and cart all use the same primary-image rule, so a cart line shows the main image of the product/variant the customer selected.

### Site settings

`/admin/settings` (owners and admins) edits the store name, announcement bar, home hero copy, support email/phone/address/hours, footer text and free-shipping threshold. Values are stored in the idempotent `site_setting` extension table, seeded with sensible defaults, and applied immediately to the header, footer and home page. The free-shipping threshold is currently informational for storefront copy; checkout still uses the exact shipping-method prices from the schema.

### Cart

Each cart line has an explicit **Remove from cart** control. It removes only that variant for both signed-in customers and guests, with no stock changes; decrementing quantity to zero also removes the line. Cart images use the shared primary-image query from `src/lib/catalog.ts`.
