import Overlay from "./Overlay.jsx";

export default function ConfirmOverlay({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
}) {
  return (
    <Overlay open={open} onClose={onCancel}>
      <div className="p-6 sm:p-8">
        {title ? (
          <h2 className="text-xl font-bold text-[var(--text)] sm:text-2xl">{title}</h2>
        ) : null}
        <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-5 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--line)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] disabled:opacity-60 ${
              danger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-[var(--primary)] hover:opacity-90"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
