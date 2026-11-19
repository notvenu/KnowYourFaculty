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
  faBars,
  faX,
  faUser,
  faTrophy,
  faPoll,
  faArrowUpRightFromSquare,
} from "@fortawesome/free-solid-svg-icons";
import ConfirmOverlay from "../overlays/ConfirmOverlay.jsx";

const COURSE_SELECTOR_URL = "https://slotify-vitap.vercel.app/course-selector";

const navClass = ({ isActive }) =>
  `nav-draw rounded-lg px-3 py-2 text-sm font-medium ${
    isActive
      ? "bg-(--panel) text-(--text)"
      : "text-(--muted) hover:bg-(--panel) hover:text-(--text)"
  }`;

const mobileNavClass = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-(--panel) text-(--text)"
      : "text-(--secondary-text) hover:bg-(--panel) hover:text-(--text)"
  }`;

const iconClass = "h-4 w-4 text-(--muted)";
const popoverClass =
  "absolute right-0 z-50 mt-2 origin-top-right overflow-hidden rounded-xl border border-(--line) bg-(--bg-elev) shadow-(--shadow-pop) transition-[opacity,transform] duration-200 ease-(--ease-out-soft)";
const popoverState = (open) =>
  open
    ? "pointer-events-auto translate-y-0 opacity-100"
    : "pointer-events-none -translate-y-1 opacity-0";

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

  const closeMobile = () => setIsMobileMenuOpen(false);
  const themeLabel =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const mobileLinks = [
    { to: "/", label: "Home", icon: faHome, end: true },
    { to: "/faculty", label: "Find professors", icon: faChalkboardUser },
    {
      href: COURSE_SELECTOR_URL,
      label: "Course selector",
      icon: faArrowUpRightFromSquare,
    },
    { to: "/rankings", label: "Rankings", icon: faTrophy },
    currentUser && { to: "/polls", label: "Polls", icon: faPoll },
    { to: "/contact", label: "Contact", icon: faEnvelope },
    isAdminUser && { to: "/admin", label: "Admin", icon: faGear },
  ].filter(Boolean);

  return (
    <>
      <header className="glass-panel sticky top-0 z-40 border-b border-(--line)">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-lg font-medium text-(--text)">
            KnowYourFaculty
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLink to="/" className={navClass} end>
                Home
              </NavLink>
              <NavLink to="/faculty" className={navClass}>
                Find professors
              </NavLink>
              <a
                href={COURSE_SELECTOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={navClass({ isActive: false })}
              >
                Course selector
              </a>
              <NavLink to="/rankings" className={navClass}>
                Rankings
              </NavLink>
              {currentUser ? (
                <NavLink to="/polls" className={navClass}>
                  Polls
                </NavLink>
              ) : null}
              <NavLink to="/contact" className={navClass}>
                Contact
              </NavLink>
              {isAdminUser ? (
                <NavLink to="/admin" className={navClass}>
                  Admin
                </NavLink>
              ) : null}
            </nav>

            <button
              type="button"
              onClick={onToggleTheme}
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-(--muted) hover:bg-(--panel) hover:text-(--text)"
              title={themeLabel}
              aria-label={themeLabel}
            >
              <FontAwesomeIcon
                icon={faSun}
                className={`absolute h-4 w-4 transition-opacity duration-200 ${
                  theme === "dark" ? "opacity-100" : "opacity-0"
                }`}
              />
              <FontAwesomeIcon
                icon={faMoon}
                className={`absolute h-4 w-4 transition-opacity duration-200 ${
                  theme === "dark" ? "opacity-0" : "opacity-100"
                }`}
              />
            </button>

            {currentUser ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium text-(--text) transition-colors ${
                    showDropdown || isDashboardPage
                      ? "border-(--muted) bg-(--panel)"
                      : "border-(--line) bg-(--bg-elev) hover:bg-(--panel)"
                  }`}
                  aria-label="User menu"
                >
                  {getInitial()}
                </button>

                <div className={`${popoverClass} w-56 ${popoverState(showDropdown)}`}>
                  <div className="border-b border-(--line) px-4 py-3">
                    <p className="truncate text-sm font-medium text-(--text)">
                      {currentUser.name || currentUser.email}
                    </p>
                    <p className="text-xs text-(--muted)">Account</p>
                  </div>
                  <div className="p-1">
                    <Link
                      to="/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-(--text) hover:bg-(--panel)"
                    >
                      <FontAwesomeIcon icon={faUser} className={iconClass} />
                      My profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDropdown(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-(--danger) hover:bg-(--danger-light)"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  onOpenLoginOverlay();
                }}
                className="btn-slide hidden h-9 items-center rounded-lg bg-(--primary) px-4 text-sm font-medium text-white sm:inline-flex"
                style={{ "--fill": "color-mix(in srgb, var(--primary), #000 35%)" }}
              >
                Sign in
              </button>
            )}

            <div className="relative lg:hidden" ref={mobileMenuRef}>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-(--text) transition-colors ${
                  isMobileMenuOpen ? "bg-(--panel)" : "hover:bg-(--panel)"
                }`}
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileMenuOpen}
              >
                <FontAwesomeIcon
                  icon={isMobileMenuOpen ? faX : faBars}
                  className="h-4 w-4"
                />
              </button>

              <div className={`${popoverClass} w-64 ${popoverState(isMobileMenuOpen)}`}>
                <nav className="flex flex-col gap-1 p-2">
                  {mobileLinks.map(({ to, href, label, icon, end }) => {
                    const inner = (
                      <span className="flex items-center gap-3">
                        <FontAwesomeIcon icon={icon} className={iconClass} />
                        {label}
                      </span>
                    );
                    return to ? (
                      <NavLink
                        key={label}
                        to={to}
                        end={end}
                        className={mobileNavClass}
                        onClick={closeMobile}
                      >
                        {inner}
                      </NavLink>
                    ) : (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={mobileNavClass({ isActive: false })}
                        onClick={closeMobile}
                      >
                        {inner}
                      </a>
                    );
                  })}
                </nav>

                <div className="border-t border-(--line) p-2">
                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={() => {
                        closeMobile();
                        onOpenLoginOverlay();
                      }}
                      className="h-10 w-full rounded-lg bg-(--primary) text-sm font-medium text-white hover:opacity-90"
                    >
                      Sign in
                    </button>
                  ) : (
                    <>
                      <div className="px-3 py-2">
                        <p className="text-xs text-(--muted)">Signed in as</p>
                        <p className="truncate text-sm font-medium text-(--text)">
                          {currentUser.name || currentUser.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          closeMobile();
                          setShowLogoutConfirm(true);
                        }}
                        className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-(--danger) hover:bg-(--danger-light)"
                      >
                        <FontAwesomeIcon icon={faSignOutAlt} className="h-4 w-4" />
                        Log out
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ConfirmOverlay
        open={showLogoutConfirm}
        title="Log out"
        message="Log out of KnowYourFaculty?"
        confirmLabel="Log out"
        cancelLabel="Stay"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
