import Overlay from "./Overlay.jsx";

const ALLOWED_DOMAIN = "vitapstudent.ac.in";

export default function LoginOverlay({ open, onClose, authError, onSignIn, signingIn = false }) {
  return (
    <Overlay open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <h2 className="text-xl font-bold text-(--text) sm:text-2xl">Sign in</h2>
        <p className="mt-3 text-sm leading-relaxed text-(--muted)">
          Only <strong className="text-(--text)">VIT-AP students</strong> can sign in.
          Use your <strong className="text-(--primary)">@{ALLOWED_DOMAIN}</strong> account only.
        </p>
        {authError ? (
          <p className="mt-4 rounded-lg border border-red-300 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600">
            {authError}
          </p>
        ) : null}
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

