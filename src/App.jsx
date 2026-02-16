/* eslint-disable no-unused-expressions */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SetupHelper from "./components/SetupHelper.jsx";
import SiteNav from "./components/SiteNav.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import LoginOverlay from "./components/LoginOverlay.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import publicFacultyService from "./services/publicFacultyService.js";
import authService, { ALLOWED_EMAIL_DOMAIN } from "./lib/appwrite/auth.js";
import clientConfig from "./config/client.js";
import "./App.css";

const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const FacultyDirectoryPage = lazy(() =>
  import("./pages/FacultyDirectoryPage.jsx")
);
const FacultyDetailPage = lazy(() => import("./pages/FacultyDetailPage.jsx"));
const ContactPage = lazy(() => import("./pages/ContactPage.jsx"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage.jsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.jsx"));

function App() {
  const location = useLocation();
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [setupChecked, setSetupChecked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [showNavbar, setShowNavbar] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("kyf-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);

  useEffect(() => {
    checkDatabaseAccess();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("kyf-theme", theme);
  }, [theme]);

  useEffect(() => {
    // Show navbar by default on non-landing pages
    if (location.pathname !== "/") {
      setShowNavbar(true);
      return;
    }

    // For landing page, show navbar on scroll
    const handleScroll = () => {
      setShowNavbar(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

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
          `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`
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
    setAuthError(null);
    setLoginInProgress(true);
    try {
      await authService.googleSignIn();
      await loadCurrentUser();
    } catch {
      setAuthError("Google login failed. Check Appwrite OAuth settings.");
    } finally {
      setLoginInProgress(false);
    }
  };

  useEffect(() => {
    if (currentUser) setShowLoginOverlay(false);
  }, [currentUser]);

  useEffect(() => {
    if (authError && !currentUser) setShowLoginOverlay(true);
  }, [authError, currentUser]);

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
              String(currentUser.email).trim().toLowerCase()
            ))
      ),
    [currentUser]
  );

  if (!setupChecked || !authChecked) {
    return (
      <div className="grid min-h-screen place-items-center bg-(--bg) text-(--text) transition-colors duration-300">
        <div className="animate-fadeIn text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-(--panel) border-t-(--primary)"></div>
          <p className="text-sm text-(--muted)">
            Setting things up for you...
          </p>
        </div>
      </div>
    );
  }

  if (isSetupMode) return <SetupHelper />;

  return (
    <div className="flex min-h-screen flex-col bg-(--bg) text-(--text) transition-colors duration-300">
      {showNavbar && (
        <SiteNav
          currentUser={currentUser}
          authError={authError}
          isAdminUser={isAdminUser}
          onOpenLoginOverlay={() => setShowLoginOverlay(true)}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() =>
            setTheme((prev) => (prev === "dark" ? "light" : "dark"))
          }
        />
      )}

      <main
        className={`flex-1 w-full ${
          showNavbar ? "px-4 py-8 sm:px-6 lg:px-8" : ""
        }`}
      >
        <div className={`${showNavbar ? "mx-auto max-w-7xl" : ""}`}>
          <Suspense
            fallback={
              <div className="grid min-h-[40vh] place-items-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-(--panel) border-t-(--primary)" />
              </div>
            }
          >
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
                  isAdminUser ? (
                    <AdminPanel />
                  ) : (
                    <Navigate to="/faculty" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <SiteFooter />
      <LoginOverlay
        open={showLoginOverlay}
        onClose={() => setShowLoginOverlay(false)}
        authError={authError}
        onSignIn={handleGoogleLogin}
        signingIn={loginInProgress}
      />
    </div>
  );
}

export default App;

