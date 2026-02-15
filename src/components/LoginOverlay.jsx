import Overlay from "./Overlay.jsx";

const ALLOWED_DOMAIN = "vitapstudent.ac.in";

export default function LoginOverlay({ open, onClose, authError, onSignIn, signingIn = false }) {
  return (
    <Overlay open={open} onClose={onClose}>
      <div className="p-6 sm:p-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Sign in</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Only <strong className="text-gray-900 dark:text-white">VIT-AP students</strong> can sign in.
          Use your <strong className="text-sky-500 dark:text-sky-400">@{ALLOWED_DOMAIN}</strong> account only.
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
            className="rounded-lg bg-sky-500 dark:bg-sky-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm dark:shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            {signingIn ? "Signing in…" : "Sign in with Google"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-900 dark:text-white transition hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </Overlay>
  );
}
