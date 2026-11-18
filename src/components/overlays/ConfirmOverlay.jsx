import { memo } from "react";
import Overlay from "./Overlay.jsx";

function ConfirmOverlay({
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
          <h2 className="text-xl font-medium text-(--text) sm:text-2xl">
            {title}
          </h2>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-(--muted)">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-(--radius) border border-(--line) bg-(--panel) px-5 py-2.5 text-sm font-medium text-(--text) transition hover:bg-(--panel-dark) disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-(--radius) px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-60 ${
              danger
                ? "bg-(--danger) hover:opacity-90"
                : "bg-(--primary) hover:opacity-90"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

export default memo(ConfirmOverlay);
