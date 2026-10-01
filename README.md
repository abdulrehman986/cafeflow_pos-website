# CafeFlow Web Platform

Production-ready online management, licensing, customer-portal and sales-sync
platform for the **CafeFlow POS** (offline-first Windows desktop app built with
Tauri 2 · React · TypeScript · Rust · SQLite).

This web platform is **not** the POS — it is the backend + dashboards the POS
talks to:

- **Public landing page** — SaaS marketing site
- **Client dashboard** — multi-restaurant sales, orders, licenses, devices
- **Admin dashboard** — platform-wide client / restaurant / license / device management
- **POS REST API** — license activation & verification, idempotent sales and
  order synchronization over HTTPS
- **Supabase-ready schema + RLS policies** — PostgreSQL migration files included

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) — runs with **Bun** |
| UI | Tailwind CSS 4 + shadcn/ui + Recharts |
| Auth | JWT sessions in httpOnly cookies (bcrypt password hashing) |
| Database | Prisma ORM — SQLite in this sandbox; **PostgreSQL via Supabase in production** (migrations in `supabase/`) |
| Validation | Zod on every API boundary |
| Rate limiting | In-memory fixed window (swap for Upstash/Redis in multi-instance deploys) |

> **Supabase note:** this repository runs against SQLite so the demo is fully
> self-contained. The exact same data model ships as PostgreSQL DDL + Row Level
> Security policies in `supabase/migrations/` — run those on your Supabase
> project and point `DATABASE_URL` at its Postgres connection string
> (Prisma provider change: `sqlite` → `postgresql`). The authorization guards
> in `src/lib/auth/guards.ts` mirror those policies 1:1, so switching involves
> no application-code changes.

---

## Architecture

```
CafeFlow POS (Tauri, offline-first, SQLite)
   │  pending sync records (unique local UUIDs)
   ▼
HTTPS REST API  (/api/pos/*)  ← device-token auth
   │
Next.js server (Zod validation, guards, rate limits)
   │
Prisma ──► Supabase PostgreSQL (unique constraints = idempotent sync, RLS)
   │
   ├──► /admin   SUPER_ADMIN dashboard
   └──► /client  CLIENT dashboard (own restaurants only)
```

**Core rule:** one client → many restaurants; each restaurant owns exactly one
license, its devices, its sales and its orders. Data isolation is enforced in
THREE layers:

1. **Proxy/edge** — cookie + role gate for `/admin` & `/client` routes
2. **Server guards** — every page/API re-verifies the session against the DB
   and scopes every query by `clientId` from the session (never from request
   params) — see `src/lib/auth/guards.ts`
3. **Database RLS** — Supabase policies in `supabase/migrations/002_rls_policies.sql`

---

## POS API (for the Tauri app)

All responses follow one contract:

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "LICENSE_EXPIRED", "message": "License has expired." } }
```

### 1. Activate a device

```http
POST /api/pos/license/activate
{
  "licenseKey": "CF-XXXX-XXXX-XXXX",
  "deviceIdentifier": "DESKTOP-ABC123",
  "deviceName": "Front counter",
  "osInfo": "Windows 11 Pro",
  "appVersion": "1.4.2"
}
```

Returns a long-lived **device token** (JWT). Store it securely in the POS
keyring; only its SHA-256 hash is stored server-side. Re-activation on the same
machine identifier simply refreshes the token. Admins can reset devices after
Windows reinstalls (`/admin/devices` → Deactivate).

### 2. Verify license (periodic, server is source of truth)

```http
POST /api/pos/license/verify        # with device token → refreshes lastVerifiedAt
GET  /api/pos/license/status        # with device token → snapshot
POST /api/pos/license/verify { "licenseKey": "..." }   # pre-activation check
```

The response includes an `offlineGrace` block (default 14 days) so the POS can
keep operating through connectivity gaps without false lockouts.

### 3. Sync sales & orders (idempotent)

```http
POST /api/pos/sales/sync
Authorization: Bearer <device-token>
{
  "sales": [{
    "localSaleId": "8f72d3a1-...",   // unique per POS database
    "saleNumber": "0001-260928",
    "saleDate": "2026-09-28T12:30:00Z",
    "subtotal": 2000, "discount": 100, "tax": 95, "total": 1995,
    "paymentMethod": "CASH", "status": "COMPLETED"
  }]
}

POST /api/pos/orders/sync
{
  "orders": [{
    "localOrderId": "...", "orderNumber": "ORD-...", "orderDate": "...",
    "total": 1523, "paymentMethod": "CARD",
    "items": [{ "name": "Chicken Karahi (Half)", "quantity": 1, "unitPrice": 1450 }]
  }]
}
```

Deduplication key: `(restaurant_id, local_sale_id)` / `(restaurant_id, local_order_id)`
— replays after network failures return `SKIPPED_DUPLICATE` per record, and the
POS can safely clear its queue from the per-record outcomes:

```json
{ "outcomes": [{ "localId": "8f72d3a1-...", "action": "CREATED" }],
  "created": 1, "skipped": 0, "failed": 0, "status": "SUCCESS" }
```

### 4. Startup config

```http
GET /api/pos/restaurant/config   # with device token
```

Restaurant identity, license snapshot + grace state, today's sync counters for
queue reconciliation.

---

## Seeded account

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@cafeflow.app` | `Admin@123` |

The seed creates only this super-admin profile. Client, restaurant, license,
device, sales, order and sync-log tables are cleared first.

Re-seed: `bun run scripts/seed.ts`

---

## Project structure

```
prisma/schema.prisma            Data model (SQLite-compatible, PG-ready)
supabase/migrations/            PostgreSQL DDL + RLS policies (production)
scripts/seed.ts                 Demo data seeder
src/proxy.ts                    Route gate (Next.js 16 proxy, ex-middleware)
src/lib/
  auth/                         jwt · session · password · guards (the "RLS")
  services/                     pos · licenses · dashboard · clients · restaurants
  validators.ts                 Zod schemas for every API boundary
  api.ts                        Response contract { success, data | error }
src/app/
  page.tsx                      Landing page
  login/ forgot-password/ …     Auth pages
  admin/                        Admin dashboard + clients/restaurants/licenses/
                                devices/sales/orders/reports/settings
  client/                       Client dashboard + restaurants/[id]/sales/orders/
                                licenses/devices/profile
  api/
    auth/                       login · logout · me · forgot/reset/change password
    admin/                      clients · restaurants · licenses · devices ·
                                dashboard (REST surface for admin)
    client/                     dashboard · restaurants · sales · orders ·
                                licenses · devices (session-scoped)
    pos/                        license/activate|verify|status · sales/sync ·
                                orders/sync · restaurant/config
src/components/                 landing/ · dashboard/ · admin/ · client/ · shared/
```

---

## Security checklist

- [x] Passwords hashed with bcrypt (cost 12); uniform login errors (no user enumeration)
- [x] Sessions = signed JWT in httpOnly, SameSite=Lax cookies; revocation-safe
      (session re-checks `isActive` + client status on every request)
- [x] Roles `SUPER_ADMIN` / `CLIENT` enforced server-side; admin APIs reject clients
- [x] Restaurant access always derived from the session's client — IDOR-proof
      (`assertRestaurantAccess` on every `[id]` page and API)
- [x] POS device tokens: HS256 JWTs, only SHA-256 hashes stored, re-validated
      against device + license + restaurant + client status on every request
- [x] License keys generated server-side with `crypto.randomBytes` (unambiguous alphabet)
- [x] Idempotent sync — DB unique constraints, not just application logic
- [x] Zod validation on every API input; predictable error codes
- [x] Rate limiting on login, reset, activation, verification and sync
- [x] Secrets only in environment variables (`AUTH_SECRET`, `POS_TOKEN_SECRET`,
      `DATABASE_URL`, SMTP credentials); nothing sensitive in client bundles
- [x] Supabase RLS deny-by-default; service key stays server-side

## Environment variables

```
DATABASE_URL=…          # MySQL/TiDB application database URL
AUTH_SECRET=…           # session JWT signing secret
POS_TOKEN_SECRET=…      # device token signing secret (separate rotation domain)

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-account@gmail.com
SMTP_PASS=…             # Google App Password, not the normal Gmail password
MAIL_FROM=CafeFlow <your-gmail-account@gmail.com>
APP_URL=https://your-cafeflow-domain.example
```

Copy `.env.example` to `.env` and replace the placeholders. For Gmail, enable
2-Step Verification and create an App Password for `SMTP_PASS`. The `APP_URL`
value must be the public URL users open from their reset emails. Password reset
links expire after 30 minutes and can only be used once.

## Scripts

```bash
bun run dev          # dev server (port 3000)
bun run lint         # eslint
bun run db:push      # apply prisma schema
bun run scripts/seed.ts  # (re)seed demo data
```
