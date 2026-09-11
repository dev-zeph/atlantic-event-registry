-- Run this once in the Supabase project's SQL editor (Database -> SQL Editor).
--
-- Intentionally open for a short-lived demo: anyone with the publishable key
-- (which ships in the deployed site's JS bundle) can read and write this
-- table. That's deliberate here -- "anyone with the link can post and see
-- confirmed dates" is the actual requirement, and this project gets deleted
-- after the demo. Do not reuse this schema as-is for anything longer-lived
-- or with real/sensitive data.

drop table if exists event_dates;

create table event_dates (
  id bigint generated always as identity primary key,
  org_name text not null,
  event_date date not null,
  status text not null check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now()
);

-- An organization has at most one entry per date: submitting again updates
-- that entry (e.g. upgrading pending -> confirmed) instead of duplicating it.
create unique index event_dates_org_date_unique
  on event_dates (org_name, event_date);

create index event_dates_event_date_idx
  on event_dates (event_date);

-- Row Level Security stays off: the publishable key needs full read/write
-- access directly, since there is no server-side secret key in this setup.
alter table event_dates disable row level security;
