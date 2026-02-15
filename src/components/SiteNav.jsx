import { Link, NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

export default function SiteNav({
  currentUser,
  authError,
  isAdminUser,
  onOpenLoginOverlay,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const getInitial = () => {
    if (currentUser?.name) {
      return currentUser.name.charAt(0).toUpperCase();
    }
    if (currentUser?.email) {
      return currentUser.email.charAt(0).toUpperCase();
    }
    return "U";
  };

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
          <span className="text-lg font-bold tracking-tight">
            KnowYourFaculty
          </span>
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
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          {currentUser ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary)] text-white font-semibold text-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
                aria-label="User menu"
              >
                {getInitial()}
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[var(--line)]">
                    <p className="text-sm font-medium text-[var(--text)] truncate">
                      {currentUser.name || currentUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onLogout();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
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
