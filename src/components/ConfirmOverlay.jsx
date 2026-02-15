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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{title}</h2>
        ) : null}
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-900 dark:text-white transition hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm dark:shadow-md transition disabled:opacity-60 ${
              danger
                ? "bg-red-500 hover:bg-red-600"
                : "bg-sky-500 dark:bg-sky-400 hover:opacity-90"
            }`}
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
