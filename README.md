# Atlantic event registry

A shared date-lodging registry: lodge a proposed event date as **pending** (shareable) or
**confirmed** (locked in), see instantly whether another organization already holds a date, and
get offered the next open date if there's a conflict &mdash; without being forced to move.

## Stack

- **Next.js** (Pages Router) &mdash; frontend + API routes
- **Supabase** (Postgres) &mdash; the shared datastore, accessed only from the server via the
  service role key. The browser never talks to Supabase directly.
- **Vercel** &mdash; hosting

## One-time setup

### 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier is enough for
   this).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) once.
3. Go to **Project Settings -> Data API** and copy the **Project URL** and the
   **`service_role`** key (not the `anon` key -- this app never uses the anon key).

### 2. Local development

```bash
cp .env.example .env.local
# paste the Project URL and service_role key into .env.local

npm install
npm run dev
```

Open http://localhost:3000.

### 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create <your-account>/atlantic-event-registry --public --source=. --remote=origin --push
```

(Or create the repo on github.com and `git remote add origin <url> && git push -u origin main`.)

### 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo you just pushed.
2. Before the first deploy, add the two environment variables from `.env.local` under **Environment
   Variables**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Leave them un-prefixed (no
   `NEXT_PUBLIC_`) -- they must stay server-only.
3. Deploy. Every future push to `main` redeploys automatically.

To pull the same environment variables back down locally later (e.g. on a new machine), once the
Vercel CLI is linked to the project: `vercel env pull .env.local`.

## How it works

- `pages/index.js` &mdash; the form (organization name, date, pending/confirmed), the calendar,
  and the paginated list of lodged dates.
- `pages/api/dates.js` &mdash; the only thing that talks to Supabase. `GET` lists all entries;
  `POST` lodges or confirms one.
- `lib/supabaseAdmin.js` &mdash; the server-only Supabase client (service role key).
- `supabase/schema.sql` &mdash; the one table this needs (`event_dates`).

### Rules encoded in the API

- **Pending** always succeeds. Multiple organizations can hold the same pending date.
- **Confirmed**: if no other organization has confirmed that date, it's confirmed immediately.
  If another organization already has, the response comes back as a conflict with a suggested
  next open date; the caller can resubmit with that date, or resubmit the original date with
  `force: true` to confirm it anyway (allowing two organizations to both be confirmed on the same
  date, by design).
- An organization has at most one row per date (enforced by a unique index on
  `(org_name, event_date)`); submitting again updates that row rather than duplicating it.

## What this does not do

- No authentication &mdash; anyone with the link can enter any organization name. Fine for a
  stakeholder demo; not fine for a real multi-tenant rollout without adding auth.
- No validation that an "organization name" is a real, unique organization &mdash; it's a free
  text field.
- No email or notification when a date is confirmed or a conflict arises.
