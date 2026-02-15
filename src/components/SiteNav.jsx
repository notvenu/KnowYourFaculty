import { Link, NavLink } from "react-router-dom";

export default function SiteNav({
  currentUser,
  authError,
  isAdminUser,
  onOpenLoginOverlay,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const navClass = ({ isActive }) =>
    `rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-sm"
        : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[var(--text)] hover:opacity-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--primary)] text-sm font-extrabold text-white shadow-sm">
            K
          </span>
          KnowYourFaculty
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          <NavLink to="/" className={navClass} end>
            Home
          </NavLink>
          <NavLink to="/faculty" className={navClass}>
            Find Professors
          </NavLink>
          <NavLink to="/contact" className={navClass}>
            Contact
          </NavLink>
          {isAdminUser ? (
            <NavLink to="/admin" className={navClass}>
              Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2 text-xs font-medium text-[var(--text)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {currentUser ? (
            <>
              <span className="max-w-48 truncate rounded-xl bg-[var(--panel)] px-3.5 py-2 text-xs font-medium text-[var(--muted)]">
                {currentUser.name || currentUser.email}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-500"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginOverlay}
              className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] hover:shadow-[var(--shadow-hover)]"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
