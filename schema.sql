-- ============================================================
-- SonDos Textile ERP — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Settings (key-value store) ───────────────────────────────
create table settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text not null unique,
  value       jsonb not null default '{}',
  updated_at  timestamptz default now()
);

insert into settings (key, value) values
  ('bunt_per_machine_per_day', 90),
  ('num_machines', 4);

-- ── Designs (carpet design database) ────────────────────────
create table designs (
  id            uuid primary key default uuid_generate_v4(),
  code          text not null unique,
  description   text,
  gsm           numeric,
  width_cm      numeric,
  colors        jsonb default '[]',
  customer      text,
  image_data    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Customers ──────────────────────────────────────────────
create table customers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  contact     text,
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Orders (one row per uploaded order file) ────────────────
create table orders (
  id            uuid primary key default uuid_generate_v4(),
  customer_id   uuid references customers(id) on delete set null,
  customer_name text not null,
  pattern_code  text,
  order_number  text,
  roll_length_m numeric default 25,
  num_designs   integer default 1,
  num_colors    integer default 1,
  total_bunt    integer default 0,
  status        text default 'pending',
  import_file   text,
  imported_at   timestamptz default now(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Order Items (design × size line items within an order) ──
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references orders(id) on delete cascade,
  customer    text,
  design_code text,
  size        text,
  piece_count integer default 0,
  total_bunt  integer default 0,
  meter_sq    numeric,
  status      text default 'pending',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── Weaving Entries (daily recording queue) ─────────────────
create table weaving_entries (
  id              uuid primary key default uuid_generate_v4(),
  date            date not null default current_date,
  customer        text,
  order_number    text,
  cut_id          text,
  density_draw    numeric,
  density_yarn    numeric,
  meter_squared   numeric,
  machine_no      text,
  position        text,
  total_bunt      integer not null default 0,
  produced_bunt   integer not null default 0,
  notes           text,
  completed       boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Machines ───────────────────────────────────────────────
create table machines (
  id            uuid primary key default uuid_generate_v4(),
  number        integer,
  model         text,
  operator      text,
  bunt_per_day  integer default 90,
  status        text default 'active',
  sort_order    integer default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Users (custom app users — built-in users live in config.js) ──
create table users (
  id             text primary key,
  label          text not null,
  username       text not null unique,
  password_hash  text not null,
  salt           text not null,
  role           text not null default 'viewer',
  is_builtin     boolean default false,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── Row-Level Security (RLS) policies ───────────────────────
alter table settings enable row level security;
alter table designs enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table weaving_entries enable row level security;
alter table machines enable row level security;
alter table users enable row level security;

-- Public read for authenticated users across all tables
create policy "Allow authenticated read"
  on settings for select to authenticated using (true);
create policy "Allow authenticated read"
  on designs for select to authenticated using (true);
create policy "Allow authenticated read"
  on customers for select to authenticated using (true);
create policy "Allow authenticated read"
  on orders for select to authenticated using (true);
create policy "Allow authenticated read"
  on order_items for select to authenticated using (true);
create policy "Allow authenticated read"
  on weaving_entries for select to authenticated using (true);
create policy "Allow authenticated read"
  on machines for select to authenticated using (true);
create policy "Allow authenticated read"
  on users for select to authenticated using (true);

-- Admin+ insert/update/delete on settings
create policy "Allow admin+ manage settings"
  on settings for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role in ('admin','owner')))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role in ('admin','owner')));

-- Owner-only manage designs
create policy "Allow editor+ manage designs"
  on designs for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'));

-- Editor+ manage customers
create policy "Allow editor+ manage customers"
  on customers for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'));

-- Editor+ manage orders and items
create policy "Allow editor+ manage orders"
  on orders for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'));

create policy "Allow editor+ manage order_items"
  on order_items for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'));

-- Editor+ manage weaving entries
create policy "Allow editor+ manage weaving"
  on weaving_entries for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'editor'));

-- Admin+ manage machines
create policy "Allow admin+ manage machines"
  on machines for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'admin'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role >= 'admin'));

-- Owner+ manage users (excluding own row deletion)
create policy "Allow owner manage users"
  on users for all to authenticated
  using (exists (select 1 from users where users.id = auth.uid()::text and users.role = 'owner'))
  with check (exists (select 1 from users where users.id = auth.uid()::text and users.role = 'owner'));
