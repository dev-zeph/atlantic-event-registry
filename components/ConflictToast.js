export default function ConflictToast({ toast, dismissing, onUseSuggested, onKeepOriginal }) {
  if (!toast) return null;

  return (
    <div className={`toast ${dismissing ? "toast-dismissing" : ""}`} role="alert">
      <p className="toast-message">
        <strong>{toast.date}</strong> is already confirmed by <strong>{toast.heldBy}</strong>.
        {toast.suggestedDate
          ? ` Use ${toast.suggestedDate} instead?`
          : " No open date was found in the next 120 days."}
      </p>
      <div className="toast-actions">
        {toast.suggestedDate && (
          <button type="button" className="toast-button primary" onClick={onUseSuggested}>
            Yes, use {toast.suggestedDate}
          </button>
        )}
        <button type="button" className="toast-button" onClick={onKeepOriginal}>
          No, keep {toast.date}
        </button>
      </div>
    </div>
  );
}
