import { useEffect, useMemo, useState } from "react";
import Calendar from "../components/Calendar";
import ConflictToast from "../components/ConflictToast";

const PAGE_SIZE = 5;
const TOAST_DISMISS_ANIMATION_MS = 220;

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

export default function Home() {
  const [orgName, setOrgName] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [dates, setDates] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [toastDismissing, setToastDismissing] = useState(false);

  const { year: initialYear, monthIndex: initialMonth } = useMemo(todayParts, []);

  async function loadDates() {
    const response = await fetch("/api/dates");
    const body = await response.json();
    setDates(body.dates || []);
  }

  useEffect(() => {
    loadDates();
  }, []);

  async function postDate({ chosenDate, chosenStatus, force }) {
    const response = await fetch("/api/dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName, date: chosenDate, status: chosenStatus, force }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Something went wrong");
    return body;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setToast(null);

    try {
      const body = await postDate({ chosenDate: date, chosenStatus: status });
      if (body.outcome === "conflict") {
        setToast(body);
        return;
      }
      setResult(body);
      setPage(1);
      await loadDates();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUseSuggested() {
    if (!toast || !toast.suggestedDate) return;
    try {
      const body = await postDate({ chosenDate: toast.suggestedDate, chosenStatus: "confirmed" });
      setDate(toast.suggestedDate);
      setToast(null);
      setResult(body);
      setPage(1);
      await loadDates();
    } catch (err) {
      setToast(null);
      setError(err.message);
    }
  }

  function handleKeepOriginal() {
    if (!toast) return;
    const original = toast;
    setToastDismissing(true);
    setTimeout(async () => {
      setToast(null);
      setToastDismissing(false);
      try {
        const body = await postDate({ chosenDate: original.date, chosenStatus: "confirmed", force: true });
        setResult(body);
        setPage(1);
        await loadDates();
      } catch (err) {
        setError(err.message);
      }
    }, TOAST_DISMISS_ANIMATION_MS);
  }

  const sortedDates = useMemo(
    () => [...dates].sort((a, b) => a.date.localeCompare(b.date) || a.orgName.localeCompare(b.orgName)),
    [dates],
  );
  const pageCount = Math.max(1, Math.ceil(sortedDates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sortedDates.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <main className="page">
      <p className="eyebrow">Atlantic Canada startup-event visibility</p>
      <h1>Event date registry</h1>
      <p className="lede">
        Lodge a date as <strong>pending</strong> while you're still deciding &mdash; multiple
        organizations can hold the same pending date. <strong>Confirm</strong> once it's locked
        in &mdash; if another organization already confirmed that date, you'll be offered the next
        open date, but you can keep your original date if you'd rather.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Organization name</span>
            <input
              required
              type="text"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              placeholder="e.g. Harbourside Founders Hub"
            />
          </label>
          <label className="field">
            <span className="field-label">Proposed event date</span>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className="field">
            <span className="field-label">Status</span>
            <div className="status-toggle">
              <button
                type="button"
                className={`status-toggle-button ${status === "pending" ? "active" : ""}`}
                onClick={() => setStatus("pending")}
              >
                Pending
              </button>
              <button
                type="button"
                className={`status-toggle-button ${status === "confirmed" ? "active" : ""}`}
                onClick={() => setStatus("confirmed")}
              >
                Confirmed
              </button>
            </div>
          </div>
          <button type="submit" className="submit">
            Submit date
          </button>
        </form>

        {error && <p className="result error">{error}</p>}
        {result && result.outcome === "pending" && (
          <p className="result pending">
            Pending &mdash; {result.date} lodged for {result.orgName}. Other organizations can
            still lodge or confirm this date.
          </p>
        )}
        {result && result.outcome === "confirmed" && (
          <p className="result success">
            Confirmed &mdash; {result.date} is now locked in for {result.orgName}.
            {result.alsoHeldBy ? ` ${result.alsoHeldBy} has also confirmed this date.` : ""}
          </p>
        )}
      </div>

      <ConflictToast
        toast={toast}
        dismissing={toastDismissing}
        onUseSuggested={handleUseSuggested}
        onKeepOriginal={handleKeepOriginal}
      />

      <p className="section-title">Calendar</p>
      <Calendar dates={dates} initialYear={initialYear} initialMonth={initialMonth} />

      <p className="section-title">Currently lodged dates</p>
      {sortedDates.length === 0 ? (
        <p className="empty">Nothing lodged yet.</p>
      ) : (
        <>
          <ul className="date-list">
            {pageItems.map((entry) => (
              <li key={`${entry.orgName}-${entry.date}-${entry.status}`}>
                <span className="date">{entry.date}</span>
                <span className="org">{entry.orgName}</span>
                <span className={`status-badge ${entry.status}`}>{entry.status}</span>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-status">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <p className="footnote">
        This is a shared registry &mdash; everyone using this link sees the same list. Enter a
        real or test organization name to try it; anyone can lodge a date as pending, and confirm
        it once it's locked in.
      </p>
    </main>
  );
}
