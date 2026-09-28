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

-- No insert/update policy - rentals carry the agreed price (see the
-- rental_offers block at the end of this file), so every create/status
-- change goes through the backend, which checks whose turn it is. The two
-- drops remove the client-write policies earlier versions of this file
-- created.
drop policy if exists "Users can create rentals as themselves" on public.rentals;
drop policy if exists "Renter or owner can update a rental" on public.rentals;

-- ---------------------------------------------------------------------------
-- Real review submission. `reviews` already existed (seed content, plain
-- reviewer_name/no account link) - this adds an optional reviewer_id so a
-- signed-in user's real review can be tied to their account and capped at
-- one per listing, without touching the seeded rows (reviewer_id stays
-- null for those).
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists reviewer_id uuid references public.profiles (id) on delete set null;

create unique index if not exists reviews_listing_reviewer_unique
  on public.reviews (listing_id, reviewer_id)
  where reviewer_id is not null;

drop policy if exists "Users can create their own reviews" on public.reviews;
create policy "Users can create their own reviews" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- ---------------------------------------------------------------------------
-- favorites: a user saving a listing. No extra metadata - just membership.
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);
create index if not exists favorites_listing_idx on public.favorites (listing_id);

alter table public.favorites enable row level security;

drop policy if exists "Users can view their own favorites" on public.favorites;
create policy "Users can view their own favorites" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "Users can add their own favorites" on public.favorites;
create policy "Users can add their own favorites" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own favorites" on public.favorites;
create policy "Users can remove their own favorites" on public.favorites
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Basic messaging: one conversation per (listing, renter) pair, so an
-- owner and a prospective renter have exactly one thread per item they're
-- discussing rather than a new one every message.
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  renter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, renter_id)
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_owner_idx on public.conversations (owner_id);
create index if not exists conversations_renter_idx on public.conversations (renter_id);
create index if not exists messages_conversation_idx on public.messages (conversation_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Participants can view their conversations" on public.conversations;
create policy "Participants can view their conversations" on public.conversations
  for select using (auth.uid() = owner_id or auth.uid() = renter_id);

drop policy if exists "Renter can start a conversation as themselves" on public.conversations;
create policy "Renter can start a conversation as themselves" on public.conversations
  for insert with check (auth.uid() = renter_id);

drop policy if exists "Participants can view their messages" on public.messages;
create policy "Participants can view their messages" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.owner_id or auth.uid() = c.renter_id)
    )
  );

drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.owner_id or auth.uid() = c.renter_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Full-text search over title+description, replacing the plain ILIKE scan.
-- Generated column + GIN index so it stays in sync automatically.
-- ---------------------------------------------------------------------------
alter table public.listings
  add column if not exists search_vector tsvector
    generated always as (
      setweight(to_tsvector('english', coalesce(title, '')), 'A')
      || setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) stored;

create index if not exists listings_search_idx on public.listings using gin (search_vector);

-- ---------------------------------------------------------------------------
-- Storage bucket for listing photos, uploaded directly from the browser
-- (frontend already talks to Supabase directly for auth, same pattern) -
-- public bucket so images render via a plain public URL, folder-per-user
-- (auth.uid()/filename) so the delete policy can check ownership by path.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view listing images" on storage.objects;
create policy "Anyone can view listing images" on storage.objects
  for select using (bucket_id = 'listing-images');

drop policy if exists "Authenticated users can upload listing images" on storage.objects;
create policy "Authenticated users can upload listing images" on storage.objects
  for insert with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');

drop policy if exists "Users can delete their own listing images" on storage.objects;
create policy "Users can delete their own listing images" on storage.objects
  for delete using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ---------------------------------------------------------------------------
-- Trust & safety: platform roles, seller verification (KYC), and rental
-- disputes.
--
-- Automated identity verification (a KYC vendor) isn't wired up here - it
-- needs real API keys (see the eKYC block below). This block lays the data
-- model + a manual-review workflow so staff can review submitted documents
-- and approve/reject sellers by hand today; the same tables are what an automated vendor check
-- would write into later without changing the shape of anything downstream.
-- ---------------------------------------------------------------------------

-- role: gates the staff/admin dashboard. A plain flag rather than a
-- separate roles table, since there's exactly one privilege boundary right
-- now (admin or not) - matches this schema's "simplest thing that works"
-- style elsewhere.
alter table public.profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin')),
  add column if not exists seller_status text not null default 'not_submitted'
    check (seller_status in ('not_submitted', 'pending', 'approved', 'rejected'));

-- kyc_submissions: one row per user - resubmitting overwrites the previous
-- attempt rather than piling up rows, since only the latest submission is
-- ever actionable. Deliberately stores document *files* (in a private
-- bucket below), not parsed Aadhaar/PAN numbers - collecting and storing
-- raw Aadhaar data requires UIDAI authorization the backend doesn't have,
-- so staff review the uploaded documents directly instead of the app
-- extracting/storing the numbers itself.
create table if not exists public.kyc_submissions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  phone text not null,
  address text not null,
  id_document_url text not null,
  address_proof_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Automated eKYC (Digio's ID Card OCR + Verification API - see
-- backend/src/services/idVerification.js). Additive to the manual-review
-- flow above, not a replacement: every submission still lands here, this
-- just records which path checked it and adds a "checked by the vendor
-- but inconclusive, needs a human" state distinct from "just submitted,
-- nothing has looked at it yet".
-- ---------------------------------------------------------------------------
alter table public.kyc_submissions
  add column if not exists verification_method text
    check (verification_method in ('manual', 'automated')),
  add column if not exists verification_provider_reference text,
  -- Digio's ID Card API wants both sides of the ID as separate uploads
  -- (front_part/back_part) - id_document_url above is the front.
  add column if not exists id_document_back_url text,
  -- Trimmed copy of Digio's response (image-quality check results, and
  -- verification_result.verified when the detected ID type supports
  -- central-database cross-checking) - shown to staff reviewing a
  -- 'manual_review' submission so they know *why* it wasn't auto-approved,
  -- rather than just that it wasn't.
  add column if not exists verification_details jsonb;

alter table public.kyc_submissions drop constraint if exists kyc_submissions_status_check;
alter table public.kyc_submissions
  add constraint kyc_submissions_status_check
    check (status in ('pending', 'manual_review', 'approved', 'rejected'));

create index if not exists kyc_submissions_provider_ref_idx
  on public.kyc_submissions (verification_provider_reference)
  where verification_provider_reference is not null;

alter table public.kyc_submissions enable row level security;

drop policy if exists "Users and admins can view a KYC submission" on public.kyc_submissions;
create policy "Users and admins can view a KYC submission" on public.kyc_submissions
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Users can submit their own KYC" on public.kyc_submissions;
create policy "Users can submit their own KYC" on public.kyc_submissions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can resubmit or admins can review KYC" on public.kyc_submissions;
create policy "Users can resubmit or admins can review KYC" on public.kyc_submissions
  for update using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Private bucket for KYC documents - unlike listing-images, these are
-- identity documents and must never be publicly readable.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own KYC documents" on storage.objects;
create policy "Users can upload their own KYC documents" on storage.objects
  for insert with check (
    bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users and admins can view KYC documents" on storage.objects;
create policy "Users and admins can view KYC documents" on storage.objects
  for select using (
    bucket_id = 'kyc-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Rental disputes: raised by either party instead of confirming a clean
-- return. Kept as its own table (rather than columns on `rentals`) so a
-- rental's dispute history is never overwritten - useful if the same
-- rental is disputed, resolved, and disputed again, and gives an audit
-- trail for decisions that move real money.
-- ---------------------------------------------------------------------------
alter table public.rentals drop constraint if exists rentals_status_check;
alter table public.rentals
  add constraint rentals_status_check
    check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled', 'disputed'));

alter table public.rentals
  add column if not exists pickup_photo_urls text[] not null default array[]::text[],
  add column if not exists return_photo_urls text[] not null default array[]::text[];

create table if not exists public.rental_disputes (
  id uuid primary key default uuid_generate_v4(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  raised_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  freeze_until timestamptz not null,
  resolution text,
  outcome text check (outcome in ('completed', 'cancelled')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rental_disputes_rental_idx on public.rental_disputes (rental_id);
create index if not exists rental_disputes_status_idx on public.rental_disputes (status);

alter table public.rental_disputes enable row level security;

drop policy if exists "Participants and admins can view disputes" on public.rental_disputes;
create policy "Participants and admins can view disputes" on public.rental_disputes
  for select using (
    auth.uid() = raised_by
    or exists (
      select 1 from public.rentals r
      join public.listings l on l.id = r.listing_id
      where r.id = rental_disputes.rental_id
        and (auth.uid() = r.renter_id or auth.uid() = l.owner_id)
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Participants can raise a dispute" on public.rental_disputes;
create policy "Participants can raise a dispute" on public.rental_disputes
  for insert with check (
    auth.uid() = raised_by
    and exists (
      select 1 from public.rentals r
      join public.listings l on l.id = r.listing_id
      where r.id = rental_disputes.rental_id
        and (auth.uid() = r.renter_id or auth.uid() = l.owner_id)
    )
  );

drop policy if exists "Admins can resolve disputes" on public.rental_disputes;
create policy "Admins can resolve disputes" on public.rental_disputes
  for update using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Rental condition photos (pickup/return) - required so a dispute has
-- evidence to point to. Own private bucket, not the public listing-images
-- one, since these can reveal a home address or other identifying detail.
insert into storage.buckets (id, name, public)
values ('rental-photos', 'rental-photos', false)
on conflict (id) do nothing;

drop policy if exists "Rental participants can upload condition photos" on storage.objects;
create policy "Rental participants can upload condition photos" on storage.objects
  for insert with check (
    bucket_id = 'rental-photos'
    and exists (
      select 1 from public.rentals r
      join public.listings l on l.id = r.listing_id
      where r.id::text = (storage.foldername(name))[1]
        and (auth.uid() = r.renter_id or auth.uid() = l.owner_id)
    )
  );

drop policy if exists "Rental participants and admins can view condition photos" on storage.objects;
create policy "Rental participants and admins can view condition photos" on storage.objects
  for select using (
    bucket_id = 'rental-photos'
    and (
      exists (
        select 1 from public.rentals r
        join public.listings l on l.id = r.listing_id
        where r.id::text = (storage.foldername(name))[1]
          and (auth.uid() = r.renter_id or auth.uid() = l.owner_id)
      )
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- The app no longer collects payments - renters pay owners directly on the
-- price they agreed in chat (see the rental_offers block below). The old
-- Razorpay escrow ledger, public.rental_payments, is no longer created or
-- read by anything. It's left alone here rather than dropped automatically,
-- since re-running this file shouldn't silently delete data - once you've
-- confirmed nothing in it is needed, remove it by hand with:
--   drop table if exists public.rental_payments;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Realtime: the messages page subscribes to postgres_changes on `messages`
-- (and `conversations`, for last-message-preview/ordering updates) instead
-- of polling. Supabase only streams changes for tables explicitly added to
-- this publication - the existing RLS policies above still apply on top of
-- that, so a client only ever receives rows it could already SELECT.
-- do block + catch since Postgres has no "add table to publication if not
-- already a member" clause, and re-adding an already-added table errors.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.messages';
  exception when duplicate_object then null;
  end;
  begin
    execute 'alter publication supabase_realtime add table public.conversations';
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- In-app notifications: a rental request landing, a request being approved/
-- rejected, a dispute being raised, a new message - anything a user should
-- hear about without having to go check their Dashboard/Messages on a
-- hunch. Always written by the backend (service_role, bypasses RLS below),
-- never by a client directly - `link` is a same-origin app path (e.g.
-- `/dashboard?tab=mine`) the frontend navigates to on click.
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications" on public.notifications
  for select using (auth.uid() = user_id);

-- Only `read` is ever client-writable (marking a notification seen) - every
-- other field is set once at insert time by the backend.
drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.notifications';
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Admin Console foundation: an audit trail for every staff action, and a
-- way for a review to be flagged for moderation (surfaced in the Reviews
-- Moderation tab, and aggregated into the Dispute Center alongside disputed
-- rentals).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_actions_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_actions_log_created_idx on public.admin_actions_log (created_at desc);

alter table public.admin_actions_log enable row level security;

-- No insert/update policy - this is only ever written by the backend
-- (service_role) right after a real staff action, never by a client
-- directly.
drop policy if exists "Admins can view the activity log" on public.admin_actions_log;
create policy "Admins can view the activity log" on public.admin_actions_log
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

alter table public.reviews
  add column if not exists flagged boolean not null default false,
  add column if not exists flag_reason text,
  add column if not exists flagged_by uuid references public.profiles (id) on delete set null,
  add column if not exists flagged_at timestamptz;

create index if not exists reviews_flagged_idx on public.reviews (flagged) where flagged;

drop policy if exists "Signed-in users can flag a review" on public.reviews;
create policy "Signed-in users can flag a review" on public.reviews
  for update using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- Platform settings: a single-row table of site-wide flags staff can toggle
-- from the Admin Console (currently just maintenance mode). Singleton via
-- `id int primary key default 1 check (id = 1)` - there is exactly one row,
-- ever.
-- ---------------------------------------------------------------------------
create table if not exists public.platform_settings (
  id int primary key default 1 check (id = 1),
  maintenance_mode boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- No insert/update policy - like admin_actions_log above, this is only
-- ever written by the backend (service_role) after a real staff action,
-- never by a client directly.
drop policy if exists "Admins can view platform settings" on public.platform_settings;
create policy "Admins can view platform settings" on public.platform_settings
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ---------------------------------------------------------------------------
-- Price offers: a rental request carries the renter's own per-day price
-- (starting from the listing's price), and the two sides bargain in the
-- listing's chat thread - each offer/counter-offer is a row here, shown in
-- chat as a card (messages.offer_id). The rental is approved the moment one
-- side accepts the other's open offer, and its price_per_day/start_date/
-- end_date are then the agreed terms. No money moves through the app - the
-- renter pays the owner directly - so these rows are the record of what
-- was agreed, e.g. for staff reviewing a dispute.
-- ---------------------------------------------------------------------------
alter table public.rentals
  -- The listing's price when the request was made, so "offered ₹450 vs
  -- listed ₹600" stays accurate even if the owner edits the listing later.
  add column if not exists listed_price_per_day numeric(10, 2)
    check (listed_price_per_day is null or listed_price_per_day >= 0),
  -- Latest offered price while pending, the agreed price once approved.
  -- Null only on requests made before offers existed (they used the
  -- listing's price).
  add column if not exists price_per_day numeric(10, 2)
    check (price_per_day is null or price_per_day >= 0),
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

create table if not exists public.rental_offers (
  id uuid primary key default uuid_generate_v4(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  price_per_day numeric(10, 2) not null check (price_per_day >= 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  -- open: waiting on the other side. countered: replaced by a newer offer.
  -- accepted: the deal. declined: the other side ended the negotiation.
  -- withdrawn: the proposer ended it.
  status text not null default 'open'
    check (status in ('open', 'countered', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now()
);

create index if not exists rental_offers_rental_idx on public.rental_offers (rental_id);
-- At most one open offer per rental - whoever didn't make it is the one
-- whose turn it is, and a double-clicked counter can't leave two open.
create unique index if not exists rental_offers_one_open_idx
  on public.rental_offers (rental_id) where status = 'open';

alter table public.rental_offers enable row level security;

-- No insert/update policy - offers are only written by the backend, which
-- enforces whose turn it is.
drop policy if exists "Rental participants and admins can view offers" on public.rental_offers;
create policy "Rental participants and admins can view offers" on public.rental_offers
  for select using (
    exists (
      select 1 from public.rentals r
      join public.listings l on l.id = r.listing_id
      where r.id = rental_offers.rental_id
        and (auth.uid() = r.renter_id or auth.uid() = l.owner_id)
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- kind: 'text' (typed by a person), 'offer' (an offer card, offer_id set),
-- or 'system' (a status line like "Deal agreed"). body always holds a
-- plain-text version, so conversation previews and old clients still read
-- sensibly.
alter table public.messages
  add column if not exists kind text not null default 'text'
    check (kind in ('text', 'offer', 'system')),
  add column if not exists offer_id uuid references public.rental_offers (id) on delete set null;

-- No double bookings: two rentals on the same listing can't both hold
-- overlapping dates (inclusive of both end days) while approved or frozen
-- in a dispute. rentals.js checks this before accepting an offer too, for
-- a friendly error - this constraint is what makes it hold when two offers
-- on the same dates are accepted at the same instant. btree_gist lets the
-- GiST index compare listing_id (a uuid) with = alongside the date range.
create extension if not exists btree_gist with schema extensions;

alter table public.rentals drop constraint if exists rentals_no_overlapping_bookings;
alter table public.rentals
  add constraint rentals_no_overlapping_bookings
    exclude using gist (listing_id with =, daterange(start_date, end_date, '[]') with &&)
    where (status in ('approved', 'disputed'));

-- Read receipts: how far each side has read a thread, up to the newest
-- message they've seen. Drives the unread counts (chat list + the navbar
-- badge) and the ✓✓ ticks, and follows the user across devices - the old
-- unread dots lived in one browser's localStorage. Written only by the
-- backend (POST /api/messages/conversations/:id/read). Existing threads
-- start as "read up to now", so shipping this doesn't light up every old
-- conversation as unread.
alter table public.conversations
  add column if not exists owner_last_read_at timestamptz not null default now(),
  add column if not exists renter_last_read_at timestamptz not null default now();

-- Replaces the policy from the messaging block above: a client may only
-- ever insert a plain text message, never an offer card or a "Deal agreed"
-- line of its own - those are written by the backend.
drop policy if exists "Participants can send messages" on public.messages;
create policy "Participants can send messages" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and kind = 'text'
    and offer_id is null
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.owner_id or auth.uid() = c.renter_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Chat attachments: photos, documents (e.g. a rental agreement PDF) and
-- locations sent from the "+" menu in Messages. Photos/documents are
-- uploaded straight from the browser into the private chat-attachments
-- bucket, in a folder named after the conversation (<conversation id>/...),
-- then the backend records a message pointing at the file. Locations need
-- no file - just coordinates.
--
-- attachment holds the details, by kind:
--   image/file: { path, name, size, mime_type }
--   location:   { lat, lng, label }
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists attachment jsonb;

-- kind's check came from `add column ... check (...)` above, so Postgres
-- named it messages_kind_check - widen it to the attachment kinds.
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
    check (kind in ('text', 'offer', 'system', 'image', 'file', 'location'));

-- Private, like rental-photos: chat files can include ID proof, addresses or
-- signed agreements. 20 MB cap and an allow-list of image/document types,
-- enforced by Supabase Storage itself on upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/rtf',
    'text/plain',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat participants can upload attachments" on storage.objects;
create policy "Chat participants can upload attachments" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[1]
        and (auth.uid() = c.owner_id or auth.uid() = c.renter_id)
    )
  );

-- Staff can open attachments too - a photo or agreement sent in chat is
-- often the evidence in a dispute.
drop policy if exists "Chat participants and admins can view attachments" on storage.objects;
create policy "Chat participants and admins can view attachments" on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and (
      exists (
        select 1 from public.conversations c
        where c.id::text = (storage.foldername(name))[1]
          and (auth.uid() = c.owner_id or auth.uid() = c.renter_id)
      )
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Terms acceptance (clickwrap). A signed-in user must accept the current
-- Terms of Service + Privacy Policy once; the profile holds the version they
-- last accepted, and terms_acceptances keeps every acceptance as an
-- evidence trail (which version, when, from what browser). Bumping
-- TERMS_VERSION in backend/src/lib/terms.js and frontend/src/content/legal.js
-- asks everyone to accept again - do that only for material changes.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

create table if not exists public.terms_acceptances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  user_agent text
);

create index if not exists terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);

alter table public.terms_acceptances enable row level security;

drop policy if exists "Users and admins can view terms acceptances" on public.terms_acceptances;
create policy "Users and admins can view terms acceptances" on public.terms_acceptances
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Clients never write to public tables directly. The frontend only reads
-- (and subscribes to realtime) with the anon key - every insert, update and
-- delete goes through the backend, which uses the service_role key and does
-- its own authorization. Supabase grants anon/authenticated full table
-- privileges by default, and several older RLS policies above allowed
-- client writes they shouldn't have: e.g. "Users can update own profile"
-- let anyone set their own role to 'admin' or seller_status to 'approved',
-- "Signed-in users can flag a review" let anyone rewrite any review, and
-- owners could edit their own listing's avg_rating. Revoking the write
-- privileges closes all of those at once, whatever the policies say - RLS
-- policies can only narrow what a role is granted, never widen it. Storage
-- uploads are unaffected (storage.objects is a separate schema).
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Language button: the site in English or 12 Indian languages, translated
-- by AI (backend/src/lib/translate.js) and stored here so each piece of
-- text is only ever translated once per language. Chat messages are never
-- translated.
--
-- preferred_language follows a logged-in user across devices. Keep the
-- list in sync with backend/src/lib/languages.js and
-- frontend/src/lib/languages.js.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
    check (preferred_language in ('en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'or', 'pa', 'as'));

-- Site text (buttons, headings, listing titles...), shared by every visitor:
-- keyed by a hash of the English text, since the text itself can be long.
create table if not exists public.ui_translations (
  lang text not null,
  source_hash text not null,
  source text not null,
  translated text not null,
  created_at timestamptz not null default now(),
  primary key (lang, source_hash)
);

-- Which model made each translation, so the warm-up script
-- (scripts/pretranslate.js) can redo ones a fallback model made while the
-- main one was busy.
alter table public.ui_translations add column if not exists model text;

-- Backend-only (service_role): RLS on with no policies means the anon and
-- authenticated roles can't read or write it directly.
alter table public.ui_translations enable row level security;
