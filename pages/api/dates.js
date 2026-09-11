import { getSupabaseServer } from "../../lib/supabaseServer";
import { orgSlug } from "../../lib/normalizeOrg";
import { utcMonthWindow, isWithinWindow, monthLabel } from "../../lib/monthWindow";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toClientShape(rows) {
  return rows.map((row) => ({
    date: row.event_date,
    status: row.status,
    orgName: row.organizations.display_name,
    orgSlug: row.organizations.slug,
  }));
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Suggestions never leave the bookable window, so we don't offer a date the
// caller would then be rejected for using.
async function nextAvailableDate(supabase, fromDate, window) {
  const { data, error } = await supabase
    .from("event_dates")
    .select("event_date")
    .eq("status", "confirmed")
    .gt("event_date", fromDate)
    .lte("event_date", window.last);
  if (error) throw error;

  const taken = new Set(data.map((row) => row.event_date));
  let candidate = addDays(fromDate, 1);
  while (candidate <= window.last) {
    if (!taken.has(candidate)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return null;
}

async function findOrg(supabase, slug) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  let supabase;
  try {
    supabase = getSupabaseServer();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("event_dates")
      .select("event_date, status, organizations!inner (slug, display_name)")
      .order("event_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ dates: toClientShape(data) });
  }

  if (req.method === "POST") {
    const { slug, date, status, force } = req.body || {};
    const normalizedSlug = orgSlug(slug);

    if (!normalizedSlug) {
      return res.status(400).json({ error: "A registered organization is required" });
    }
    if (typeof date !== "string" || !DATE_RE.test(date)) {
      return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    }
    if (status !== "pending" && status !== "confirmed") {
      return res.status(400).json({ error: 'status must be "pending" or "confirmed"' });
    }

    const window = utcMonthWindow();
    if (!isWithinWindow(date, window)) {
      return res.status(400).json({
        error: `Only ${monthLabel(window)} dates can be booked during this test.`,
      });
    }

    try {
      const org = await findOrg(supabase, normalizedSlug);
      if (!org) {
        return res.status(404).json({ error: "That organization is not registered yet" });
      }

      async function upsertEntry(targetDate, targetStatus) {
        const { error } = await supabase
          .from("event_dates")
          .upsert(
            { org_id: org.id, event_date: targetDate, status: targetStatus },
            { onConflict: "org_id,event_date" },
          );
        if (error) throw error;
      }

      if (status === "pending") {
        const { data: existing, error: existingError } = await supabase
          .from("event_dates")
          .select("status")
          .eq("org_id", org.id)
          .eq("event_date", date)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing?.status !== "pending") await upsertEntry(date, "pending");
        return res.status(200).json({ outcome: "pending", date, orgName: org.display_name });
      }

      // status === "confirmed"
      const { data: existingConfirmed, error: conflictError } = await supabase
        .from("event_dates")
        .select("organizations!inner (display_name)")
        .eq("event_date", date)
        .eq("status", "confirmed")
        .neq("org_id", org.id)
        .limit(1)
        .maybeSingle();
      if (conflictError) throw conflictError;

      if (existingConfirmed && !force) {
        // Don't commit yet: surface the conflict and a suggested alternative
        // so the caller can ask the user, then resubmit with force:true or
        // with the suggested date.
        const suggestedDate = await nextAvailableDate(supabase, date, window);
        return res.status(200).json({
          outcome: "conflict",
          date,
          orgName: org.display_name,
          heldBy: existingConfirmed.organizations.display_name,
          suggestedDate,
        });
      }

      // Either no conflict, or the caller explicitly chose to confirm anyway:
      // two organizations can end up confirmed on the same date, by design.
      await upsertEntry(date, "confirmed");
      return res.status(200).json({
        outcome: "confirmed",
        date,
        orgName: org.display_name,
        alsoHeldBy: existingConfirmed ? existingConfirmed.organizations.display_name : undefined,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
