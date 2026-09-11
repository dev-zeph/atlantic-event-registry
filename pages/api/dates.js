import { getSupabaseAdmin } from "../../lib/supabaseAdmin";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SUGGESTION_LOOKAHEAD_DAYS = 120;

function toClientShape(rows) {
  return rows.map((row) => ({ orgName: row.org_name, date: row.event_date, status: row.status }));
}

function addDays(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function nextAvailableDate(supabase, fromDate) {
  const windowEnd = addDays(fromDate, MAX_SUGGESTION_LOOKAHEAD_DAYS);
  const { data, error } = await supabase
    .from("event_dates")
    .select("event_date")
    .eq("status", "confirmed")
    .gt("event_date", fromDate)
    .lte("event_date", windowEnd);
  if (error) throw error;

  const taken = new Set(data.map((row) => row.event_date));
  let candidate = fromDate;
  for (let i = 0; i < MAX_SUGGESTION_LOOKAHEAD_DAYS; i += 1) {
    candidate = addDays(candidate, 1);
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

export default async function handler(req, res) {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("event_dates")
      .select("org_name, event_date, status")
      .order("event_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ dates: toClientShape(data) });
  }

  if (req.method === "POST") {
    const { orgName, date, status, force } = req.body || {};
    if (typeof orgName !== "string" || orgName.trim().length === 0) {
      return res.status(400).json({ error: "orgName is required" });
    }
    if (typeof date !== "string" || !DATE_RE.test(date)) {
      return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
    }
    if (status !== "pending" && status !== "confirmed") {
      return res.status(400).json({ error: 'status must be "pending" or "confirmed"' });
    }

    const trimmedOrg = orgName.trim();

    async function upsertEntry(targetDate, targetStatus) {
      const { error } = await supabase
        .from("event_dates")
        .upsert(
          { org_name: trimmedOrg, event_date: targetDate, status: targetStatus },
          { onConflict: "org_name,event_date" },
        );
      if (error) throw error;
    }

    try {
      if (status === "pending") {
        const { data: existing, error: existingError } = await supabase
          .from("event_dates")
          .select("status")
          .eq("org_name", trimmedOrg)
          .eq("event_date", date)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing?.status !== "pending") await upsertEntry(date, "pending");
        return res.status(200).json({ outcome: "pending", date, orgName: trimmedOrg });
      }

      // status === "confirmed"
      const { data: existingConfirmed, error: conflictError } = await supabase
        .from("event_dates")
        .select("org_name")
        .eq("event_date", date)
        .eq("status", "confirmed")
        .neq("org_name", trimmedOrg)
        .limit(1)
        .maybeSingle();
      if (conflictError) throw conflictError;

      if (existingConfirmed && !force) {
        const suggestedDate = await nextAvailableDate(supabase, date);
        return res.status(200).json({
          outcome: "conflict",
          date,
          orgName: trimmedOrg,
          heldBy: existingConfirmed.org_name,
          suggestedDate,
        });
      }

      await upsertEntry(date, "confirmed");
      return res.status(200).json({
        outcome: "confirmed",
        date,
        orgName: trimmedOrg,
        alsoHeldBy: existingConfirmed ? existingConfirmed.org_name : undefined,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
