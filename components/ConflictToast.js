export default function ConflictToast({ toast, dismissing, onUseSuggested, onKeepOriginal }) {
  if (!toast) return null;

  return (
    <div className={`toast ${dismissing ? "is-dismissing" : ""}`} role="alert">
      <p className="toast-title">Date already confirmed</p>
      <p className="toast-message">
        {toast.heldBy} has confirmed {toast.date}.
        {toast.suggestedDate
          ? ` The next open date is ${toast.suggestedDate}. Use that instead?`
          : " No open date was found in the next 120 days."}
      </p>
      <div className="toast-actions">
        {toast.suggestedDate && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onUseSuggested}>
            Use {toast.suggestedDate}
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onKeepOriginal}>
          Keep {toast.date}
        </button>
      </div>
    </div>
  );
}
