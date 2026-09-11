-- Run this once in the Supabase project's SQL editor (Database -> SQL Editor).

create table if not exists event_dates (
  id bigint generated always as identity primary key,
  org_name text not null,
  event_date date not null,
  status text not null check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now()
);

-- An organization has at most one entry per date: submitting again updates
-- that entry (e.g. upgrading pending -> confirmed) instead of duplicating it.
create unique index if not exists event_dates_org_date_unique
  on event_dates (org_name, event_date);

create index if not exists event_dates_event_date_idx
  on event_dates (event_date);

-- This table is only ever read/written by the server (via the service role
-- key in the Next.js API routes), never directly from the browser, so Row
-- Level Security stays enabled with no public policies -- the anon key alone
-- cannot read or write this table.
alter table event_dates enable row level security;
