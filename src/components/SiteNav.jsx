import { Link, NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faChalkboardUser,
  faEnvelope,
  faGear,
  faSignOutAlt,
  faSun,
  faMoon,
  faChevronRight,
  faCircle,
  faBars,
  faX,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

export default function SiteNav({
  currentUser,
  isAdminUser,
  onOpenLoginOverlay,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const location = useLocation();
  const isDashboardPage = location.pathname === "/dashboard";
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    if (showDropdown || isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, isMobileMenuOpen]);

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
        ? "bg-(--primary-soft) text-(--primary) shadow-sm"
        : "text-(--muted) hover:bg-(--panel) hover:text-(--text)"
    }`;

  const mobileNavClass = ({ isActive }) =>
    `rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-gradient-to-r from-(--primary-soft) to-transparent text-(--primary) font-semibold"
        : "text-(--text) hover:bg-(--panel) hover:text-(--primary)"
    }`;

  return (
    <>
      {/* Backdrop overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-[color-mix(in_srgb,var(--text)_15%,transparent)] backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <header className="glass-panel sticky top-0 z-40 border-b border-(--line) transition-colors duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-3 text-(--text) transition hover:opacity-90"
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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--line) bg-(--panel) text-xs font-medium text-(--text) transition-all duration-200 hover:border-(--primary) hover:bg-(--primary-soft) hover:shadow-md active:scale-95"
                title={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                <FontAwesomeIcon
                  icon={theme === "dark" ? faSun : faMoon}
                  className="w-4 h-4"
                />
              </button>

              {currentUser ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-(--primary) to-[color-mix(in_srgb,var(--primary)_80%,transparent)] text-white font-bold text-sm transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-(--primary) focus:ring-offset-2 ${
                      showDropdown || isDashboardPage
                        ? "ring-2 ring-(--primary) ring-offset-2"
                        : ""
                    }`}
                    aria-label="User menu"
                  >
                    {getInitial()}
                  </button>

                  <div
                    className={`absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-(--line) bg-(--bg-elev) shadow-2xl backdrop-blur-xl z-50 origin-top-right transform transition-all duration-300 ease-out ${
                      showDropdown
                        ? "opacity-100 translate-y-0 scale-100"
                        : "pointer-events-none opacity-0 -translate-y-2 scale-95"
                    }`}
                  >
                    {/* Gradient accent */}
                    <div className="absolute inset-0 bg-linear-to-br from-(--primary-soft)/20 via-transparent to-transparent pointer-events-none" />

                    <div className="relative z-10 border-b border-(--line) bg-linear-to-r from-(--primary-soft)/10 to-transparent px-4 py-3">
                      <p className="truncate text-sm font-semibold text-(--text)">
                        {currentUser.name || currentUser.email}
                      </p>
                      <p className="text-xs text-(--muted) mt-0.5">Account</p>
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="relative z-10 flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-(--text) transition-all hover:bg-(--panel) hover:pl-6"
                    >
                      <FontAwesomeIcon icon={faUser} className="w-3.5 h-3.5" />
                      <span>My Profile</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium text-red-500 transition-all hover:bg-red-500/10 hover:pl-6 active:bg-red-500/20"
                    >
                      <span className="flex items-center gap-2">
                        <FontAwesomeIcon
                          icon={faSignOutAlt}
                          className="w-3.5 h-3.5"
                        />
                        <span>Logout</span>
                      </span>
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
                  className="hidden rounded-xl bg-linear-to-r from-(--primary) to-[color-mix(in_srgb,var(--primary)_80%,transparent)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95 sm:inline-flex items-center gap-2"
                >
                  <span>Sign in</span>
                  <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                </button>
              )}

              <div className="relative lg:hidden" ref={mobileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all duration-200 ease-out active:scale-95 ${
                    isMobileMenuOpen
                      ? "border-(--primary) bg-(--primary-soft) shadow-md"
                      : "border-(--line) bg-(--panel) hover:border-(--primary) hover:bg-(--primary-soft)"
                  }`}
                  aria-label="Toggle navigation menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  <FontAwesomeIcon
                    icon={isMobileMenuOpen ? faX : faBars}
                    className="w-4 h-4"
                  />
                </button>

                {/* Mobile Dropdown Menu */}
                <div
                  className={`absolute right-0 mt-2 w-64 origin-top-right transform transition-all duration-300 ease-out lg:hidden z-50 ${
                    isMobileMenuOpen
                      ? "pointer-events-auto opacity-100 scale-100 translate-y-0"
                      : "pointer-events-none opacity-0 scale-95 -translate-y-2"
                  }`}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-(--line) bg-(--bg-elev) shadow-2xl backdrop-blur-xl">
                    {/* Gradient accent */}
                    <div className="absolute inset-0 bg-linear-to-br from-(--primary-soft)/30 via-transparent to-transparent pointer-events-none" />

                    {/* Content */}
                    <div className="relative z-10">
                      {/* Header */}
                      <div className="border-b border-(--line) bg-linear-to-r from-(--primary-soft)/20 to-transparent px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-(--text) flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={faCircle}
                              className="w-2 h-2 text-(--primary) animate-pulse"
                            />
                            Menu
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-(--line) bg-(--panel) text-(--text) transition-all hover:border-(--primary) hover:bg-(--primary-soft) active:scale-95"
                            aria-label="Close navigation menu"
                          >
                            <FontAwesomeIcon
                              icon={faX}
                              className="w-3.5 h-3.5"
                            />
                          </button>
                        </div>
                      </div>

                      {/* Navigation Links */}
                      <nav className="flex flex-col gap-1 p-2">
                        <NavLink
                          to="/"
                          end
                          className={mobileNavClass}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span className="flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={faHome}
                              className="w-4 h-4 text-(--primary)"
                            />
                            Home
                          </span>
                        </NavLink>
                        <NavLink
                          to="/faculty"
                          className={mobileNavClass}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span className="flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={faChalkboardUser}
                              className="w-4 h-4 text-(--primary)"
                            />
                            Find Professors
                          </span>
                        </NavLink>
                        <NavLink
                          to="/contact"
                          className={mobileNavClass}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span className="flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={faEnvelope}
                              className="w-4 h-4 text-(--primary)"
                            />
                            Contact
                          </span>
                        </NavLink>
                        {currentUser ? (
                          <NavLink
                            to="/dashboard"
                            className={mobileNavClass}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <span className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faUser}
                                className="w-4 h-4 text-(--primary)"
                              />
                              Dashboard
                            </span>
                          </NavLink>
                        ) : null}
                        {isAdminUser ? (
                          <NavLink
                            to="/admin"
                            className={mobileNavClass}
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <span className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faGear}
                                className="w-4 h-4 text-(--primary)"
                              />
                              Admin
                            </span>
                          </NavLink>
                        ) : null}

                        {/* Sign in button for non-logged users */}
                        {!currentUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              onOpenLoginOverlay();
                            }}
                            className="mt-2 mx-2 rounded-xl bg-linear-to-r from-(--primary) to-[color-mix(in_srgb,var(--primary)_80%,transparent)] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <span className="flex items-center justify-center gap-2">
                              <span>Sign in</span>
                              <FontAwesomeIcon
                                icon={faChevronRight}
                                className="w-3 h-3"
                              />
                            </span>
                          </button>
                        ) : (
                          <div className="mt-2 mx-2 border-t border-(--line) pt-2">
                            <div className="rounded-xl bg-(--panel) px-4 py-3">
                              <p className="text-xs font-medium text-(--muted) mb-1">
                                Signed in as
                              </p>
                              <p className="text-sm font-semibold text-(--text) truncate">
                                {currentUser.name || currentUser.email}
                              </p>
                            </div>
                          </div>
                        )}
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
