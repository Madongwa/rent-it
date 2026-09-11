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
