// eslint-disable-next-line tailwindcss/no-custom-classname
/* eslint-disable tailwindcss/no-custom-classname, no-unused-expressions */
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import SetupHelper from "./components/SetupHelper.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import FacultyDirectoryPage from "./pages/FacultyDirectoryPage.jsx";
import FacultyDetailPage from "./pages/FacultyDetailPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import publicFacultyService from "./services/publicFacultyService.js";
import authService, { ALLOWED_EMAIL_DOMAIN } from "./lib/appwrite/auth.js";
import clientConfig from "./config/client.js";
import "./App.css";

function App() {
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [setupChecked, setSetupChecked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("kyf-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    checkDatabaseAccess();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kyf-theme", theme);
  }, [theme]);

  const checkDatabaseAccess = async () => {
    try {
      await publicFacultyService.getFacultyList({ limit: 1 });
      setIsSetupMode(false);
    } catch {
      setIsSetupMode(true);
    } finally {
      setSetupChecked(true);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        setCurrentUser(null);
        return;
      }

      if (!authService.isAllowedEmail(user.email)) {
        await authService.logout();
        setCurrentUser(null);
        setAuthError(
          `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
        );
        return;
      }

      setCurrentUser(user);
    } catch {
      setAuthError("Unable to verify login state.");
    } finally {
      setAuthChecked(true);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await authService.googleSignIn();
    } catch {
      setAuthError("Google login failed. Check Appwrite OAuth settings.");
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
    } catch {
      setAuthError("Logout failed. Please try again.");
    }
  };

  const isAdminUser = useMemo(
    () =>
      Boolean(
        currentUser?.email &&
        (clientConfig.adminEmails.length === 0 ||
          clientConfig.adminEmails.includes(
            String(currentUser.email).trim().toLowerCase(),
          )),
      ),
    [currentUser],
  );

  if (!setupChecked || !authChecked) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--text)]">
        <div className="animate-fadeIn text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--soft)] border-t-[var(--primary)]"></div>
          <p className="text-sm text-[var(--muted)]">
            ✨ Setting things up for you...
          </p>
        </div>
      </div>
    );
  }

  if (isSetupMode) return <SetupHelper />;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteNav
        currentUser={currentUser}
        authError={authError}
        isAdminUser={isAdminUser}
        onGoogleLogin={handleGoogleLogin}
        onLogout={handleLogout}
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === "dark" ? "light" : "dark"))
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/faculty"
            element={<FacultyDirectoryPage currentUser={currentUser} />}
          />
          <Route
            path="/faculty/:facultyId"
            element={<FacultyDetailPage currentUser={currentUser} />}
          />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPage />} />
          <Route path="/terms-and-conditions" element={<TermsPage />} />
          <Route
            path="/admin"
            element={
              isAdminUser ? <AdminPanel /> : <Navigate to="/faculty" replace />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteNav({
  currentUser,
  authError,
  isAdminUser,
  onGoogleLogin,
  onLogout,
  theme,
  onToggleTheme,
}) {
  const navClass = ({ isActive }) =>
    `rounded-full px-3 py-2 text-sm transition ${
      isActive
        ? "bg-[color-mix(in_srgb,var(--primary)_22%,transparent)] text-[var(--primary)]"
        : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--text)]"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight hover:scale-105 transition-transform"
          >
            <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-[var(--primary)] text-xs text-[#04222b]">
              ✧
            </span>
            KnowYourFaculty
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          <NavLink to="/" className={navClass} end>
            🏠 Home
          </NavLink>
          <NavLink to="/faculty" className={navClass}>
            🔍 Find Professors
          </NavLink>
          <NavLink to="/contact" className={navClass}>
            💬 Contact
          </NavLink>
          {isAdminUser ? (
            <NavLink to="/admin" className={navClass}>
              ⚙️ Admin
            </NavLink>
          ) : null}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs hover:border-[var(--primary)] hover:scale-105 transition-all"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>

          {currentUser ? (
            <>
              <span className="max-w-56 truncate rounded-full bg-[var(--panel)] px-3 py-2 text-xs text-[var(--muted)]">
                👤 {currentUser.name || currentUser.email}
              </span>
              <button
                onClick={onLogout}
                className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-4 py-2 text-sm hover:border-red-400 hover:text-red-400 transition-all"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <button
              onClick={onGoogleLogin}
              className="flex items-center gap-1 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all"
            >
              <span>🔑</span> Sign In with Google
            </button>
          )}
        </div>
      </div>
      {!currentUser && authError ? (
        <p className="animate-shake px-4 pb-3 text-center text-xs text-red-500 sm:px-6 lg:px-8">
          ⚠️ {authError}
        </p>
      ) : null}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_90%,black)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-xs text-[var(--muted)] sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2 flex-wrap">
          <span>🔒 Anonymous & Safe</span>
          <span>•</span>
          <span>✔️ Verified Students</span>
          <span>•</span>
          <span>© 2026 KnowYourFaculty</span>
        </p>
        <nav className="flex flex-wrap items-center gap-4">
          <Link
            to="/privacy-policy"
            className="hover:text-[var(--text)] transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms-and-conditions"
            className="hover:text-[var(--text)] transition-colors"
          >
            Terms & Conditions
          </Link>
          <Link
            to="/contact"
            className="hover:text-[var(--text)] transition-colors"
          >
            💌 Contact Us
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export default App;
