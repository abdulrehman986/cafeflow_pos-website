-- ═══════════════════════════════════════════════════════════════════════════
-- CafeFlow — Supabase PostgreSQL migration 001: initial schema
--
-- Mirrors the Prisma schema used by the running application 1:1.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Data model:
--   profiles (auth users, roles) ──> clients ──> restaurants ──> licenses
--                                                    ├──> devices
--                                                    ├──> sales      (idempotent sync)
--                                                    └──> orders ──> order_items
--   sync_logs records every POS sync batch.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────── ENUMS ───────────────
create type user_role        as enum ('SUPER_ADMIN', 'CLIENT');
create type client_status    as enum ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
create type restaurant_status as enum ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
create type license_status   as enum ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED');
create type device_status    as enum ('PENDING', 'ACTIVE', 'BLOCKED', 'DEACTIVATED');
create type order_status     as enum ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED');
create type payment_method   as enum ('CASH', 'CARD', 'MOBILE', 'OTHER');
create type sync_status      as enum ('SUCCESS', 'PARTIAL', 'FAILED');
create type sync_record_type as enum ('SALES', 'ORDERS');

-- ─────────────── PROFILES (linked to Supabase auth.users) ───────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  phone         text,
  role          user_role not null default 'CLIENT',
  client_id     uuid unique references public.clients(id) on delete set null,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_client on public.profiles(client_id);

-- Note: when using Supabase Auth, credentials live in auth.users — no
-- password_hash column is needed here. The Next.js app issues its own JWT
-- session cookie after Supabase sign-in, or uses @supabase/ssr directly.

-- ─────────────── CLIENTS ───────────────
create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,             -- primary contact person
  email        text not null unique,
  phone        text,
  company_name text not null,
  status       client_status not null default 'ACTIVE',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_clients_status on public.clients(status);

-- ─────────────── RESTAURANTS ───────────────
create table public.restaurants (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  address    text,
  city       text,
  phone      text,
  status     restaurant_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_restaurants_client on public.restaurants(client_id);
create index idx_restaurants_status on public.restaurants(status);

-- ─────────────── LICENSES ───────────────
create table public.licenses (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  license_key      text not null unique,
  status           license_status not null default 'PENDING',
  max_devices      integer not null default 1 check (max_devices between 1 and 20),
  activated_at     timestamptz,
  expires_at       timestamptz not null,
  last_verified_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_licenses_restaurant on public.licenses(restaurant_id);
create index idx_licenses_status on public.licenses(status);
create index idx_licenses_key on public.licenses(license_key);
create index idx_licenses_expires on public.licenses(expires_at);

-- One live (non-revoked) license per restaurant; REVOKED stays for audit.
create unique index one_live_license_per_restaurant
  on public.licenses(restaurant_id) where status <> 'REVOKED';

-- ─────────────── DEVICES ───────────────
create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  license_id        uuid not null references public.licenses(id) on delete cascade,
  device_identifier text not null,
  device_name       text,
  os_info           text,
  app_version       text,
  device_token_hash text not null unique,   -- SHA-256 of the POS device token
  status            device_status not null default 'ACTIVE',
  activated_at      timestamptz not null default now(),
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index uq_device_per_restaurant on public.devices(restaurant_id, device_identifier);
create index idx_devices_restaurant on public.devices(restaurant_id);
create index idx_devices_license on public.devices(license_id);
create index idx_devices_status on public.devices(status);

-- ─────────────── SALES (idempotent POS sync) ───────────────
create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  local_sale_id  text not null,
  sale_number    text,
  sale_date      timestamptz not null,
  subtotal       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null check (total >= 0),
  payment_method payment_method,
  status         order_status not null default 'COMPLETED',
  customer_count integer,
  synced_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
-- IDEMPOTENCY: replaying the same sale after a network failure is a no-op.
alter table public.sales
  add constraint uq_sale_restaurant_local unique (restaurant_id, local_sale_id);
create index idx_sales_restaurant_date on public.sales(restaurant_id, sale_date);
create index idx_sales_date on public.sales(sale_date);
create index idx_sales_status on public.sales(status);

-- ─────────────── ORDERS (idempotent POS sync) ───────────────
create table public.orders (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  local_order_id text not null,
  order_number   text not null,
  order_date     timestamptz not null,
  subtotal       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  tax            numeric(12,2) not null default 0,
  total          numeric(12,2) not null check (total >= 0),
  payment_method payment_method,
  status         order_status not null default 'COMPLETED',
  customer_count integer,
  synced_at      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
alter table public.orders
  add constraint uq_order_restaurant_local unique (restaurant_id, local_order_id);
create index idx_orders_restaurant_date on public.orders(restaurant_id, order_date);
create index idx_orders_date on public.orders(order_date);
create index idx_orders_status on public.orders(status);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  local_item_id text,
  name          text not null,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  total         numeric(12,2) not null check (total >= 0),
  category      text
);
create index idx_order_items_order on public.order_items(order_id);

-- ─────────────── SYNC LOGS ───────────────
create table public.sync_logs (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  device_id        uuid references public.devices(id) on delete set null,
  record_type      sync_record_type not null,
  records_received integer not null default 0,
  records_created  integer not null default 0,
  records_skipped  integer not null default 0,
  records_failed   integer not null default 0,
  status           sync_status not null,
  message          text,
  created_at       timestamptz not null default now()
);
create index idx_sync_logs_restaurant on public.sync_logs(restaurant_id);
create index idx_sync_logs_created on public.sync_logs(created_at desc);

-- ─────────────── PASSWORD RESET TOKENS (self-hosted auth only) ───────────────
create table public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index idx_prt_profile on public.password_reset_tokens(profile_id);
