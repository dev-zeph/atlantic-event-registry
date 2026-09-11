-- Run this once in the Supabase project's SQL editor (Database -> SQL Editor).
--
-- Intentionally open for a short-lived demo: anyone with the publishable key
-- (which ships in the deployed site's JS bundle) can read and write these
-- tables. That's deliberate here, "anyone with the link can post and see
-- confirmed dates" is the actual requirement, and this project gets deleted
-- after the demo. Do not reuse this schema as-is for anything longer-lived
-- or with real or sensitive data.

drop table if exists event_dates;
drop table if exists organizations;

-- One row per organization. `slug` is the normalized form of the name used
-- for matching, so "Volta Labs", "volta labs" and "Volta Labs Inc." with
-- stray punctuation all resolve to the same organization. `display_name` is
-- what the person actually typed, shown back in the UI.
create table organizations (
  id bigint generated always as identity primary key,
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table event_dates (
  id bigint generated always as identity primary key,
  org_id bigint not null references organizations (id) on delete cascade,
  event_date date not null,
  status text not null check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now(),
  -- An organization has at most one entry per date: submitting again updates
  -- that entry (e.g. upgrading pending -> confirmed) instead of duplicating.
  constraint event_dates_org_date_unique unique (org_id, event_date)
);

create index event_dates_event_date_idx on event_dates (event_date);
create index event_dates_org_id_idx on event_dates (org_id);

-- Row Level Security stays off: the publishable key needs full read/write
-- access directly, since there is no server-side secret key in this setup.
alter table organizations disable row level security;
alter table event_dates disable row level security;
