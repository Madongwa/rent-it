-- Rent It - Supabase schema
-- Run this once in your Supabase project's SQL editor (Database -> SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT guards where possible.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup (see
-- trigger below). This is what listings/rentals reference instead of
-- auth.users directly, since auth.users isn't queryable from the client.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories: the 3 top-level types shown on the home page
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  description text,
  icon text
);

insert into public.categories (slug, name, description, icon) values
  ('farming', 'Farming Tools', 'Tractors, tillers, irrigation gear and more', '🌾'),
  ('construction', 'Construction Tools', 'Power tools, scaffolding, heavy equipment', '🏗️'),
  ('diy', 'Household & DIY', 'Drills, ladders, and everyday tools', '🛠️'),
  ('events', 'Events', 'Tents, sound systems, tables and lighting for any event', '🎪'),
  ('moving', 'Moving', 'Dollies, trailers, and everything for moving day', '📦'),
  ('medical', 'Medical', 'Mobility aids and home-care equipment', '🩺')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- listings: items posted for rent
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id int not null references public.categories (id),
  title text not null,
  description text,
  price_per_day numeric(10, 2) not null check (price_per_day >= 0),
  location text,
  condition text,
  image_url text,
  status text not null default 'available'
    check (status in ('available', 'rented', 'inactive')),
  created_at timestamptz not null default now()
);

create index if not exists listings_category_idx on public.listings (category_id);
create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists listings_status_idx on public.listings (status);

-- ---------------------------------------------------------------------------
-- Marketplace filter fields - added for the sidebar filter rebuild. Safe to
-- re-run: `add column if not exists` is a no-op if already applied.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists power_source text
    check (power_source in ('electric', 'petrol', 'diesel', 'manual', 'battery')),
  add column if not exists delivery_option text not null default 'pickup_only'
    check (delivery_option in ('owner_delivers', 'pickup_only', 'either')),
  add column if not exists deposit_required boolean not null default false,
  add column if not exists cancellation_policy text not null default 'flexible'
    check (cancellation_policy in ('free', 'flexible', 'strict')),
  add column if not exists owner_type text not null default 'individual'
    check (owner_type in ('individual', 'business')),
  add column if not exists accessories_included boolean not null default false;

create index if not exists listings_power_source_idx on public.listings (power_source);
create index if not exists listings_delivery_idx on public.listings (delivery_option);

-- Widen power_source to cover items it just doesn't apply to (a wheelchair,
-- a ladder, a set of moving blankets) instead of forcing them into
-- 'manual'. Drop + recreate since Postgres has no "alter check constraint"
-- - safe to re-run, and existing electric/petrol/diesel/manual/battery rows
-- already satisfy the widened list.
alter table public.listings drop constraint if exists listings_power_source_check;
alter table public.listings
  add constraint listings_power_source_check
    check (power_source in ('electric', 'petrol', 'diesel', 'manual', 'battery', 'not_applicable'));

-- ---------------------------------------------------------------------------
-- Filter/detail-page build-out fields (Marketplace filters + Listing Detail
-- rebuild). Same "safe to re-run" pattern as the block above.
--
-- Note on `condition`: left as free text (no check constraint) rather than
-- constrained to the 4-value enum the filter UI presents (New/Like New/
-- Good/Fair) - ListItem.jsx's own condition dropdown already includes a
-- 5th value ("Well Used") that predates this build-out, and a DB-level
-- constraint would start rejecting listing creates/edits that use it.
--
-- Note on `accessories_included` vs `accessories_note`: accessories_included
-- (boolean, added above) already backs the working "Accessories Included"
-- filter (yes/no). accessories_note is new and separate - the short
-- free-text description ("Comes with extension cord and case") shown on the
-- Listing Detail page - so the existing boolean filter semantics don't
-- change underneath it.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists deposit_amount numeric(10, 2) check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists accessories_note text,
  add column if not exists min_rental_period text not null default 'no_minimum'
    check (min_rental_period in ('no_minimum', '1_day', '3_day', 'weekly')),
  add column if not exists supported_durations text[] not null default array['daily']::text[],
  add column if not exists distance_km numeric(5, 1) check (distance_km is null or distance_km >= 0),
  add column if not exists avg_rating numeric(2, 1) not null default 0
    check (avg_rating >= 0 and avg_rating <= 5),
  add column if not exists review_count int not null default 0 check (review_count >= 0);

create index if not exists listings_min_rental_period_idx on public.listings (min_rental_period);
create index if not exists listings_avg_rating_idx on public.listings (avg_rating);

-- ---------------------------------------------------------------------------
-- reviews: reviewer_name/comment are plain text rather than a profiles FK -
-- seeded as demo content standing in for real reviews (no review-writing
-- flow exists yet), so there's no real reviewer account to reference.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reviewer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists reviews_listing_idx on public.reviews (listing_id);

-- ---------------------------------------------------------------------------
-- rental_history: past completed rentals shown on the Listing Detail page
-- (calendar + list). Deliberately separate from `rentals` (the real
-- pending/approved booking-request workflow) - this is seeded demo history
-- with a plain display name, not a renter_id FK, for the same reason as
-- reviews above.
-- ---------------------------------------------------------------------------
create table if not exists public.rental_history (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  renter_display_name text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  amount_paid numeric(10, 2) not null check (amount_paid >= 0),
  created_at timestamptz not null default now()
);

create index if not exists rental_history_listing_idx on public.rental_history (listing_id);

-- ---------------------------------------------------------------------------
-- rentals: requests to rent a listing for a date range
-- ---------------------------------------------------------------------------
create table if not exists public.rentals (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  renter_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists rentals_listing_idx on public.rentals (listing_id);
create index if not exists rentals_renter_idx on public.rentals (renter_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The backend server talks to Supabase with the service_role key, which
-- bypasses RLS entirely - the checks below are a second line of defense
-- (e.g. in case a client ever queries Supabase directly with the anon key).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.reviews enable row level security;
alter table public.rental_history enable row level security;
alter table public.rentals enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Categories are viewable by everyone" on public.categories;
create policy "Categories are viewable by everyone" on public.categories
  for select using (true);

drop policy if exists "Listings are viewable by everyone" on public.listings;
create policy "Listings are viewable by everyone" on public.listings
  for select using (true);

drop policy if exists "Users can insert own listings" on public.listings;
create policy "Users can insert own listings" on public.listings
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update own listings" on public.listings;
create policy "Users can update own listings" on public.listings
  for update using (auth.uid() = owner_id);

drop policy if exists "Users can delete own listings" on public.listings;
create policy "Users can delete own listings" on public.listings
  for delete using (auth.uid() = owner_id);

drop policy if exists "Reviews are viewable by everyone" on public.reviews;
create policy "Reviews are viewable by everyone" on public.reviews
  for select using (true);

drop policy if exists "Rental history is viewable by everyone" on public.rental_history;
create policy "Rental history is viewable by everyone" on public.rental_history
  for select using (true);

drop policy if exists "Renters and owners can view relevant rentals" on public.rentals;
create policy "Renters and owners can view relevant rentals" on public.rentals
  for select using (
    auth.uid() = renter_id
    or auth.uid() = (select owner_id from public.listings where listings.id = rentals.listing_id)
  );

drop policy if exists "Users can create rentals as themselves" on public.rentals;
create policy "Users can create rentals as themselves" on public.rentals
  for insert with check (auth.uid() = renter_id);

drop policy if exists "Renter or owner can update a rental" on public.rentals;
create policy "Renter or owner can update a rental" on public.rentals
  for update using (
    auth.uid() = renter_id
    or auth.uid() = (select owner_id from public.listings where listings.id = rentals.listing_id)
  );
