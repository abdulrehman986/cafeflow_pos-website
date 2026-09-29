-- ═══════════════════════════════════════════════════════════════════════════
-- CafeFlow — Supabase PostgreSQL migration 002: Row Level Security
--
-- SECURITY MODEL (mirrors the app-level guards in src/lib/auth/guards.ts):
--   SUPER_ADMIN  → full access to every row in every table.
--   CLIENT       → only rows belonging to restaurants owned by their client.
--   POS devices  → write ONLY through the service role (server APIs), never
--                  directly from the desktop app with user credentials.
--
-- A client can NEVER read another client's clients/restaurants/licenses/
-- devices/sales/orders, even by crafting arbitrary queries — Postgres itself
-- rejects the row.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────── helper functions (SECURITY DEFINER, safe search path) ───────────────

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'SUPER_ADMIN' and is_active
  );
$$;

create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

-- The client id of the current user (null for admins / unauthenticated)
create or replace function public.current_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- Does the current user own the restaurant with this id?
create or replace function public.owns_restaurant(rid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.restaurants r
    join public.profiles p on p.client_id = r.client_id
    where r.id = rid
      and p.id = auth.uid()
      and p.role = 'CLIENT'
  );
$$;

-- ─────────────── enable RLS everywhere ───────────────
alter table public.profiles              enable row level security;
alter table public.clients               enable row level security;
alter table public.restaurants           enable row level security;
alter table public.licenses              enable row level security;
alter table public.devices               enable row level security;
alter table public.sales                 enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.sync_logs             enable row level security;
alter table public.password_reset_tokens enable row level security;

-- ─────────────── PROFILES ───────────────
-- Everyone can read their own profile; admins read all; nobody reads others'.
create policy "profiles: read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- Inserts/updates of role/client linkage only via service role or admin.
create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.is_super_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_super_admin());

-- ─────────────── CLIENTS ───────────────
create policy "clients: read own or admin"
  on public.clients for select
  using (id = public.current_client_id() or public.is_super_admin());

create policy "clients: admin write"
  on public.clients for insert
  with check (public.is_super_admin());

create policy "clients: admin update"
  on public.clients for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "clients: admin delete"
  on public.clients for delete
  using (public.is_super_admin());

-- ─────────────── RESTAURANTS ───────────────
create policy "restaurants: read owned or admin"
  on public.restaurants for select
  using (
    public.is_super_admin()
    or client_id = public.current_client_id()
  );

create policy "restaurants: admin insert"
  on public.restaurants for insert
  with check (public.is_super_admin());

create policy "restaurants: admin update"
  on public.restaurants for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "restaurants: admin delete"
  on public.restaurants for delete
  using (public.is_super_admin());

-- ─────────────── LICENSES ───────────────
create policy "licenses: read owned or admin"
  on public.licenses for select
  using (
    public.is_super_admin()
    or public.owns_restaurant(restaurant_id)
  );

create policy "licenses: admin insert"
  on public.licenses for insert
  with check (public.is_super_admin());

create policy "licenses: admin update"
  on public.licenses for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "licenses: admin delete"
  on public.licenses for delete
  using (public.is_super_admin());

-- ─────────────── DEVICES ───────────────
create policy "devices: read owned or admin"
  on public.devices for select
  using (
    public.is_super_admin()
    or public.owns_restaurant(restaurant_id)
  );

create policy "devices: admin write"
  on public.devices for insert
  with check (public.is_super_admin());

create policy "devices: admin update"
  on public.devices for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "devices: admin delete"
  on public.devices for delete
  using (public.is_super_admin());

-- ─────────────── SALES ───────────────
create policy "sales: read owned or admin"
  on public.sales for select
  using (
    public.is_super_admin()
    or public.owns_restaurant(restaurant_id)
  );

-- POS sync writes happen through the Next.js server (service role key),
-- which bypasses RLS by design — never from a browser client.
create policy "sales: service insert"
  on public.sales for insert
  with check (public.is_super_admin());

-- ─────────────── ORDERS ───────────────
create policy "orders: read owned or admin"
  on public.orders for select
  using (
    public.is_super_admin()
    or public.owns_restaurant(restaurant_id)
  );

create policy "orders: service insert"
  on public.orders for insert
  with check (public.is_super_admin());

-- ─────────────── ORDER ITEMS ───────────────
create policy "order_items: read owned or admin"
  on public.order_items for select
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.owns_restaurant(o.restaurant_id)
    )
  );

create policy "order_items: service insert"
  on public.order_items for insert
  with check (public.is_super_admin());

-- ─────────────── SYNC LOGS ───────────────
create policy "sync_logs: read owned or admin"
  on public.sync_logs for select
  using (
    public.is_super_admin()
    or public.owns_restaurant(restaurant_id)
  );

create policy "sync_logs: service insert"
  on public.sync_logs for insert
  with check (public.is_super_admin());

-- ─────────────── PASSWORD RESET TOKENS ───────────────
-- Only the server (service role) touches these; no user-facing policies.
create policy "prt: admin read"
  on public.password_reset_tokens for select
  using (public.is_super_admin());

create policy "prt: admin insert"
  on public.password_reset_tokens for insert
  with check (public.is_super_admin());

create policy "prt: admin update"
  on public.password_reset_tokens for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─────────────── DEFAULT DENY ───────────────
-- RLS is deny-by-default: anything without an explicit policy above is
-- unreachable for anon/authenticated roles. The anon key gets nothing;
-- the service role key is held ONLY by the Next.js server.
revoke all on all tables in schema public from anon;
