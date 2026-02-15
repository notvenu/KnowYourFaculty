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
    <header className="glass-panel sticky top-0 z-40 border-b border-[var(--line)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[var(--text)] transition hover:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] bg-[var(--primary)] text-sm font-extrabold text-white shadow-[var(--shadow-card)]">
            K
          </span>
          <span className="text-lg font-bold tracking-tight">KnowYourFaculty</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-0.5">
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
            className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {currentUser ? (
            <>
              <span className="max-w-48 truncate rounded-[var(--radius)] bg-[var(--panel)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
                {currentUser.name || currentUser.email}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-500"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onOpenLoginOverlay}
              className="rounded-[var(--radius)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:shadow-[var(--shadow-hover)]"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
