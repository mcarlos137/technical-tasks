-- Games schema for PostgreSQL 14 or newer. The API reads it when DATABASE_URL is set;
-- otherwise it serves data/games.json, which holds the same data.
-- `docker compose up -d` runs this file and the seed on the first start.

-- Accent-insensitive venue search, so "aliga" finds "L'Àliga".
create extension if not exists unaccent;

create table if not exists public.venues (
  id text primary key,
  name text not null,
  address text
);

create table if not exists public.organizers (
  id text primary key,
  display_name text not null,
  avatar_url text
);

create table if not exists public.games (
  id text primary key,
  -- Kick-off as an absolute instant and as the literal local ISO string with its offset,
  -- so local dates and times never go through a timezone conversion. The check keeps
  -- the two in step.
  starts_at timestamptz not null,
  starts_at_local text not null check (starts_at_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$'),
  constraint games_starts_at_consistent check (starts_at = starts_at_local::timestamptz),
  -- Local date and kick-off time, derived from starts_at_local, so the API's date and
  -- time-of-day filters are plain indexed comparisons.
  local_date text generated always as (left(starts_at_local, 10)) stored,
  local_start_time text generated always as (substr(starts_at_local, 12, 5)) stored,
  duration_minutes int not null check (duration_minutes > 0),
  venue_id text not null references public.venues(id),
  format text not null,
  organizer_id text not null references public.organizers(id),
  spots_total int not null check (spots_total > 0),
  spots_available int not null check (spots_available >= 0 and spots_available <= spots_total),
  is_recorded boolean not null default false,
  price_eur numeric(6,2) not null check (price_eur >= 0)
);

create index if not exists games_local_date_idx on public.games (local_date, local_start_time);
create index if not exists games_venue_idx on public.games (venue_id);
create index if not exists games_organizer_idx on public.games (organizer_id);
