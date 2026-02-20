import Overlay from "./Overlay.jsx";

const ALLOWED_DOMAIN = "vitapstudent.ac.in";

export default function LoginOverlay({
  open,
  onClose,
  authError,
  onSignIn,
  signingIn = false,
}) {
  return (
    <Overlay open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <h2 className="text-xl font-bold text-(--text) sm:text-2xl">Sign in</h2>
        <p className="mt-3 text-sm leading-relaxed text-(--muted)">
          Only <strong className="text-(--text)">VIT-AP students</strong> can
          sign in. Use your{" "}
          <strong className="text-(--primary)">@{ALLOWED_DOMAIN}</strong>{" "}
          account only.
        </p>
        <div className="mt-3 rounded-lg border border-(--line) bg-(--panel) px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-(--text)">
            Note
          </p>
          <p className="mt-1 text-xs leading-snug text-(--muted)">
            Sign-in is only for student verification. Public feedback is
            anonymous. Editing or deletion of account, feedback, and related
            user data can be done at any time by the account owner.
          </p>
        </div>
        <div
          className={`mt-4 overflow-hidden transition-all duration-300 ease-out ${
            authError
              ? "max-h-24 translate-y-0 opacity-100"
              : "max-h-0 -translate-y-2 opacity-0"
          }`}
          aria-live="polite"
        >
          <p
            className={`rounded-lg border border-red-300 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 transition-transform duration-300 ${
              authError ? "translate-y-0 animate-shake" : "-translate-y-2"
            }`}
            role={authError ? "alert" : undefined}
          >
            {authError || " "}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSignIn}
            disabled={signingIn}
            className="rounded-(--radius) bg-(--primary) px-5 py-2.5 text-sm font-semibold text-white shadow-(--shadow) transition hover:shadow-(--shadow-hover) hover:opacity-90 disabled:opacity-60"
          >
            {signingIn ? "Signing in…" : "Sign in with Google"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-(--radius) border border-(--line) bg-(--panel) px-5 py-2.5 text-sm font-medium text-(--text) transition hover:border-(--primary) hover:bg-(--primary-soft)"
          >
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}
