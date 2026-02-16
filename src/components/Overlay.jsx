import { useEffect } from "react";

export default function Overlay({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--text)_40%,transparent)] backdrop-blur-md"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose?.()}
        role="button"
        tabIndex={0}
        aria-label="Close overlay"
      />
      <div className="relative z-10 w-full max-w-md rounded-(--radius-xl) border border-(--line) bg-(--bg-elev) shadow-(--shadow-card)">
        {children}
      </div>
    </div>
  );
}

