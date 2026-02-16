import { Link, NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

export default function SiteNav({
  currentUser,
  isAdminUser,
  onOpenLoginOverlay,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    <header className="glass-panel sticky top-0 z-40 border-b border-[var(--line)] transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[var(--text)] transition hover:opacity-90"
        >
          <span className="text-lg font-bold tracking-tight">
            KnowYourFaculty
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-0.5 lg:flex">
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
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

                <div
                  className={`absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] shadow-lg z-50 origin-top-right transform transition-all duration-200 ease-out ${
                    showDropdown
                      ? "opacity-100 translate-y-0"
                      : "pointer-events-none opacity-0 -translate-y-2"
                  }`}
                >
                  <div className="border-b border-[var(--line)] px-4 py-3">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {currentUser.name || currentUser.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-500 transition hover:bg-red-500/10"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenLoginOverlay();
                }}
                className="hidden rounded-[var(--radius)] bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:shadow-[var(--shadow-hover)] sm:inline-flex"
              >
                Sign in
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] lg:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open navigation</span>
              <span className="flex h-3.5 w-5 flex-col justify-between">
                <span
                  className={`block h-0.5 w-full rounded-full bg-[var(--text)] transition-transform ${
                    isMobileMenuOpen ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-0.5 w-full rounded-full bg-[var(--text)] transition-opacity ${
                    isMobileMenuOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`block h-0.5 w-full rounded-full bg-[var(--text)] transition-transform ${
                    isMobileMenuOpen ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-30 transform transition-all duration-300 ease-out lg:hidden ${
          isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity ${
            isMobileMenuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div
          className={`absolute inset-y-0 right-0 w-72 max-w-[80vw] border-l border-[var(--line)] bg-[var(--bg-elev)] shadow-[var(--shadow-card)] transition-transform duration-300 ease-out ${
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--text)]">
              Menu
            </span>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[var(--text)]"
              aria-label="Close navigation menu"
            >
              ×
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-4 py-4">
            <NavLink
              to="/"
              end
              className={navClass}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/faculty"
              className={navClass}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Find Professors
            </NavLink>
            <NavLink
              to="/contact"
              className={navClass}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Contact
            </NavLink>
            {isAdminUser ? (
              <NavLink
                to="/admin"
                className={navClass}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Admin
              </NavLink>
            ) : null}

            {!currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenLoginOverlay();
                }}
                className="mt-2 rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow)] transition hover:shadow-[var(--shadow-hover)]"
              >
                Sign in
              </button>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}
