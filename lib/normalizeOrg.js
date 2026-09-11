// Organization names are matched on a normalized "slug" so that the same
// organization typed slightly differently still resolves to one record:
//
//   "Volta Labs"      -> "volta labs"
//   "volta  labs"     -> "volta labs"
//   "Volta Labs Inc." -> "volta labs inc"
//   "Café Collectif"  -> "cafe collectif"
//
// Digits are stripped too, so "Startup 365" and "Startup" collide. That is a
// deliberate tradeoff for this demo: names here are organizations, not
// products, and loose matching is better than duplicate records.
export function orgSlug(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .normalize("NFKD") // separate accented letters into base + accent mark
    .replace(/[\u0300-\u036f]/g, "") // drop the accent marks
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ") // letters and whitespace only
    .replace(/\s+/g, " ")
    .trim();
}

// What gets shown back in the UI: the person's own capitalisation and
// punctuation, just tidied of stray whitespace.
export function orgDisplayName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}
