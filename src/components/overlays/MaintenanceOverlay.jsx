import { useState, useEffect } from "react";

export default function MaintenanceOverlay() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--text)_40%,transparent)] backdrop-blur-md"
        onClick={() => setDismissed(true)}
        onKeyDown={(e) => e.key === "Enter" && setDismissed(true)}
        role="button"
        tabIndex={0}
        aria-label="Dismiss maintenance message"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-(--line) bg-(--bg-elev) shadow-(--shadow-card)">
        <div className="p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-(--primary-soft) text-3xl">
            🔧
          </div>
          <h2
            id="maintenance-title"
            className="text-xl font-bold text-(--text) sm:text-2xl"
          >
            Website Under Maintenance
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-(--muted)">
            We&rsquo;re currently making some improvements. We&rsquo;ll be back{" "}
            <strong className="text-(--primary)">as soon as possible</strong>.
            Thank you for your patience!
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss maintenance message"
            className="mt-6 rounded-(--radius) border border-(--line) bg-(--panel) px-5 py-2.5 text-sm font-medium text-(--text) transition hover:border-(--primary) hover:bg-(--primary-soft)"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
