-- Games schema. Optional: the API only uses it when SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY are set; otherwise it serves data/games.json.
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
  -- Kick-off as an absolute instant (for ordering/range queries) and as the literal
  -- local ISO string with offset, so the API derives local date/time without
  -- timezone conversion surprises. Both are written together by the seed.
  starts_at timestamptz not null,
  starts_at_local text not null check (starts_at_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$'),
  constraint games_starts_at_consistent check (starts_at = starts_at_local::timestamptz),
  duration_minutes int not null check (duration_minutes > 0),
  venue_id text not null references public.venues(id),
  format text not null,
  organizer_id text not null references public.organizers(id),
  spots_total int not null check (spots_total > 0),
  spots_available int not null check (spots_available >= 0 and spots_available <= spots_total),
  is_recorded boolean not null default false,
  price_eur numeric(6,2) not null check (price_eur >= 0)
);

create index if not exists games_starts_at_idx on public.games (starts_at);
create index if not exists games_venue_idx on public.games (venue_id);

-- Read access only through the API (service role). No anon policies are created,
-- so the tables are not reachable from the public REST endpoint.
alter table public.venues enable row level security;
alter table public.organizers enable row level security;
alter table public.games enable row level security;
