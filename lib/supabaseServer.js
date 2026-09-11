import { createClient } from "@supabase/supabase-js";

// Server-side client using the publishable key. Row Level Security is
// intentionally off for this table (see supabase/schema.sql) for a
// short-lived demo, so the publishable key already has full read/write
// access -- there is no secret key in this setup.
//
// Lazy singleton: the env vars may not be set at build time, so avoid
// constructing the client at module scope.
let _client = null;

export function getSupabaseServer() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY. Set them in .env.local (dev) or the Vercel project's environment variables (deployed).",
    );
  }

  _client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  return _client;
}
