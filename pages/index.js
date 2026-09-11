import { useEffect, useMemo, useState } from "react";
import Calendar from "../components/Calendar";
import ConflictToast from "../components/ConflictToast";
import { localMonthWindow, monthLabel } from "../lib/monthWindow";

const PAGE_SIZE = 8;
const STORAGE_KEY = "aer.org";
const TOAST_DISMISS_MS = 220;

function readStoredOrg() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredOrg(org) {
  try {
    if (org) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(org));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private browsing or blocked storage: the session just won't persist */
  }
}

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

/* -------------------------------------------------------------------------
   Organization gate
   ------------------------------------------------------------------------- */
function OrgGate({ onRegistered }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: name }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || "Something went wrong");
        return;
      }
      onRegistered({ slug: body.slug, displayName: body.displayName });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="gate-eyebrow">Atlantic event registry</p>
        <h1 className="gate-title">Which organization are you?</h1>
        <p className="gate-lede">
          Enter your organization name to see the shared calendar and lodge your own dates. No
          account, no password.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="label">Organization name</span>
            <input
              className="input"
              required
              autoFocus
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Volta Labs"
            />
            <span className="hint">
              Capitalisation and punctuation are ignored when matching, so you will always land
              back on the same organization.
            </span>
          </label>
          {error && <p className="alert alert-danger">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Main app
   ------------------------------------------------------------------------- */
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [org, setOrg] = useState(null);

  const [tab, setTab] = useState("all");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [dates, setDates] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState(null);
  const [toastDismissing, setToastDismissing] = useState(false);

  const { year: initialYear, monthIndex: initialMonth } = useMemo(todayParts, []);
  const bookableWindow = useMemo(() => localMonthWindow(), []);

  useEffect(() => {
    setOrg(readStoredOrg());
    setMounted(true);
  }, []);

  async function loadDates() {
    const response = await fetch("/api/dates");
    const body = await response.json();
    setDates(body.dates || []);
  }

  useEffect(() => {
    if (org) loadDates();
  }, [org]);

  function handleRegistered(nextOrg) {
    writeStoredOrg(nextOrg);
    setOrg(nextOrg);
  }

  function handleSwitchOrg() {
    writeStoredOrg(null);
    setOrg(null);
    setDates([]);
    setResult(null);
    setToast(null);
    setTab("all");
  }

  async function postDate({ chosenDate, chosenStatus, force }) {
    const response = await fetch("/api/dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: org.slug, date: chosenDate, status: chosenStatus, force }),
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
    if (!toast?.suggestedDate) return;
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
        const body = await postDate({
          chosenDate: original.date,
          chosenStatus: "confirmed",
          force: true,
        });
        setResult(body);
        setPage(1);
        await loadDates();
      } catch (err) {
        setError(err.message);
      }
    }, TOAST_DISMISS_MS);
  }

  const myDates = useMemo(
    () => dates.filter((entry) => entry.orgSlug === org?.slug),
    [dates, org],
  );

  const visibleDates = tab === "mine" ? myDates : dates;

  const sortedDates = useMemo(
    () =>
      [...visibleDates].sort(
        (a, b) => a.date.localeCompare(b.date) || a.orgName.localeCompare(b.orgName),
      ),
    [visibleDates],
  );

  const pageCount = Math.max(1, Math.ceil(sortedDates.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sortedDates.slice(pageStart, pageStart + PAGE_SIZE);

  function switchTab(next) {
    setTab(next);
    setPage(1);
  }

  if (!mounted) return null;
  if (!org) return <OrgGate onRegistered={handleRegistered} />;

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-name">Atlantic event registry</span>
            <span className="brand-sub">Shared event dates across the region</span>
          </div>
          <div className="org-chip">
            <div className="org-chip-name">
              <span className="org-chip-label">Signed in as</span>
              <span className="org-chip-value">{org.displayName}</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleSwitchOrg}>
              Switch
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "all" ? "is-active" : ""}`}
            onClick={() => switchTab("all")}
          >
            All organizations
            <span className="tab-count">{dates.length}</span>
          </button>
          <button
            type="button"
            className={`tab ${tab === "mine" ? "is-active" : ""}`}
            onClick={() => switchTab("mine")}
          >
            Our dates
            <span className="tab-count">{myDates.length}</span>
          </button>
        </div>

        {tab === "all" && (
          <div className="card">
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span className="label">Proposed event date</span>
                  <input
                    className="input"
                    required
                    type="date"
                    value={date}
                    min={bookableWindow.first}
                    max={bookableWindow.last}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  <span className="hint">
                    Test window: {monthLabel(bookableWindow)} only.
                  </span>
                </label>

                <div className="field">
                  <span className="label">Status</span>
                  <div className="segmented">
                    <button
                      type="button"
                      className={`segmented-option ${status === "pending" ? "is-active" : ""}`}
                      onClick={() => setStatus("pending")}
                    >
                      Pending
                    </button>
                    <button
                      type="button"
                      className={`segmented-option ${status === "confirmed" ? "is-active" : ""}`}
                      onClick={() => setStatus("confirmed")}
                    >
                      Confirmed
                    </button>
                  </div>
                  <p className="hint">
                    {status === "pending"
                      ? "Other organizations can hold the same pending date."
                      : "Locks the date in. You will be warned if someone else already confirmed it."}
                  </p>
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  Submit date
                </button>
              </form>

              {error && <p className="alert alert-danger">{error}</p>}
              {result?.outcome === "pending" && (
                <p className="alert alert-pending">
                  Pending. {result.date} is lodged for {result.orgName}, and other organizations
                  can still lodge or confirm it.
                </p>
              )}
              {result?.outcome === "confirmed" && (
                <p className="alert alert-success">
                  Confirmed. {result.date} is locked in for {result.orgName}.
                  {result.alsoHeldBy ? ` ${result.alsoHeldBy} has also confirmed this date.` : ""}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-head">
            <span className="section-title">
              {tab === "mine" ? "Our calendar" : "Regional calendar"}
            </span>
            <span className="section-meta">Hover a marked day to see who holds it</span>
          </div>
          <Calendar
            dates={visibleDates}
            initialYear={initialYear}
            initialMonth={initialMonth}
            mySlug={org.slug}
            window={bookableWindow}
          />
        </div>

        <div className="section">
          <div className="section-head">
            <span className="section-title">
              {tab === "mine" ? "Dates we have booked" : "All lodged dates"}
            </span>
            <span className="section-meta">
              {sortedDates.length} {sortedDates.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          {sortedDates.length === 0 ? (
            <p className="empty-state">
              {tab === "mine"
                ? "You have not lodged any dates yet."
                : "No dates lodged yet. Be the first."}
            </p>
          ) : (
            <>
              <ul className="list">
                {pageItems.map((entry) => (
                  <li
                    key={`${entry.orgSlug}-${entry.date}`}
                    className={`list-row ${entry.orgSlug === org.slug ? "is-mine" : ""}`}
                  >
                    <span className="list-date">{entry.date}</span>
                    <span className="list-org">{entry.orgName}</span>
                    <span className={`badge badge-${entry.status}`}>{entry.status}</span>
                  </li>
                ))}
              </ul>
              {pageCount > 1 && (
                <div className="pagination">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
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
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={currentPage === pageCount}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="footer-note">
          Everyone using this link shares one registry. Dates only, never topics or speakers.
        </p>
      </main>

      <ConflictToast
        toast={toast}
        dismissing={toastDismissing}
        onUseSuggested={handleUseSuggested}
        onKeepOriginal={handleKeepOriginal}
      />
    </>
  );
}
