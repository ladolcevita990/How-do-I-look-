-- How Do I Look? — Supabase schema
--
-- Run this once in your Supabase project:
--   Supabase dashboard → SQL Editor → paste this file → Run
--
-- This creates the four tables the app needs (sessions, photos, garments,
-- outfits) plus the outfit_items join table, enables row-level security
-- with permissive policies (session_id is a uuid the client keeps in
-- localStorage, so rows are scoped by obscurity rather than auth), and
-- creates the public `hdil` storage bucket for all images.

-- =============================================================================
-- Tables
-- =============================================================================

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_session_idx on public.photos(session_id);

create table if not exists public.garments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  name text not null default '',
  brand text not null default '',
  category text not null,
  accessory_type text,
  storage_path text not null,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists garments_session_idx on public.garments(session_id);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  share_id uuid not null default gen_random_uuid(),
  name text not null default 'Untitled look',
  storage_path text,
  created_at timestamptz not null default now()
);

create unique index if not exists outfits_share_idx on public.outfits(share_id);
create index if not exists outfits_session_idx on public.outfits(session_id);

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  garment_id uuid not null references public.garments(id) on delete cascade,
  category text not null,
  accessory_type text
);

create index if not exists outfit_items_outfit_idx on public.outfit_items(outfit_id);

-- =============================================================================
-- Row-level security
-- =============================================================================
-- All data is keyed by session_id (a uuid the client stores in localStorage).
-- There are no accounts, so we allow anonymous reads and writes to every
-- table. Security comes from the uuid being unguessable.

alter table public.photos enable row level security;
alter table public.garments enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

drop policy if exists "anon read photos" on public.photos;
drop policy if exists "anon write photos" on public.photos;
drop policy if exists "anon read garments" on public.garments;
drop policy if exists "anon write garments" on public.garments;
drop policy if exists "anon read outfits" on public.outfits;
drop policy if exists "anon write outfits" on public.outfits;
drop policy if exists "anon read outfit_items" on public.outfit_items;
drop policy if exists "anon write outfit_items" on public.outfit_items;

create policy "anon read photos"      on public.photos      for select using (true);
create policy "anon write photos"     on public.photos      for all    using (true) with check (true);
create policy "anon read garments"    on public.garments    for select using (true);
create policy "anon write garments"   on public.garments    for all    using (true) with check (true);
create policy "anon read outfits"     on public.outfits     for select using (true);
create policy "anon write outfits"    on public.outfits     for all    using (true) with check (true);
create policy "anon read outfit_items" on public.outfit_items for select using (true);
create policy "anon write outfit_items" on public.outfit_items for all    using (true) with check (true);

-- =============================================================================
-- Storage bucket
-- =============================================================================
-- Public bucket so composited images can be shared via permalink. Objects
-- are stored under sessions/{session_id}/{type}/{uuid}.{ext} — obscurity
-- again.

insert into storage.buckets (id, name, public)
values ('hdil', 'hdil', true)
on conflict (id) do update set public = true;

-- Storage policies — allow anonymous uploads into the hdil bucket.
drop policy if exists "anon read hdil" on storage.objects;
drop policy if exists "anon write hdil" on storage.objects;

create policy "anon read hdil"
  on storage.objects for select
  using (bucket_id = 'hdil');

create policy "anon write hdil"
  on storage.objects for insert
  with check (bucket_id = 'hdil');

-- That's it. The client uses the anon key to hit these tables and the
-- bucket directly — no server required.
