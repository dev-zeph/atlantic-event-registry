import { getSupabaseServer } from "../../lib/supabaseServer";
import { orgSlug, orgDisplayName } from "../../lib/normalizeOrg";

// Registers or looks up an organization by its normalized name. There is no
// password: entering the same organization name gets you back to the same
// organization's records, which is the whole sign-in model for this demo.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  let supabase;
  try {
    supabase = getSupabaseServer();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { orgName } = req.body || {};
  const slug = orgSlug(orgName);
  const displayName = orgDisplayName(orgName);

  if (!slug) {
    return res.status(400).json({
      error: "Enter an organization name using letters (numbers and symbols are ignored).",
    });
  }

  try {
    const { data: existing, error: lookupError } = await supabase
      .from("organizations")
      .select("slug, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      // Keep the first display name that was registered, so the same
      // organization doesn't visually rename itself each time someone types
      // it slightly differently.
      return res.status(200).json({
        slug: existing.slug,
        displayName: existing.display_name,
        returning: true,
      });
    }

    const { data: created, error: insertError } = await supabase
      .from("organizations")
      .insert({ slug, display_name: displayName })
      .select("slug, display_name")
      .single();
    if (insertError) throw insertError;

    return res.status(200).json({
      slug: created.slug,
      displayName: created.display_name,
      returning: false,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
