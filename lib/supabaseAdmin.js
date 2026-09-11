import { createClient } from "@supabase/supabase-js";

// Server-only client using the service role key. Never import this file from
// client-side code and never expose SUPABASE_SERVICE_ROLE_KEY to the browser
// -- it bypasses Row Level Security entirely.
//
// Lazy singleton: the env vars may not be set at build time (e.g. before
// Supabase is provisioned), so avoid constructing the client at module scope.
let _client = null;

export function getSupabaseAdmin() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local (dev) or the Vercel project's environment variables (deployed).",
    );
  }

  _client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return _client;
}
