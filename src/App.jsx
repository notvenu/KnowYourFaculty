﻿﻿﻿/* eslint-disable no-unused-expressions */
import { lazy, Suspense, useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import SetupHelper from "./components/admin/SetupHelper.jsx";
import SiteNav from "./components/layout/SiteNav.jsx";
import SiteFooter from "./components/layout/SiteFooter.jsx";
import LoginOverlay from "./components/overlays/LoginOverlay.jsx";
import AdminPanel from "./components/admin/AdminPanel.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import publicFacultyService from "./services/publicFacultyService.js";
import {
  loadCurrentUser,
  googleSignIn,
  logout,
  setShowLoginOverlay,
  setAuthError,
} from "./store/authSlice.js";
import {
  setShowNavbar,
  setIsSetupMode,
  setSetupChecked,
  toggleTheme,
} from "./store/uiSlice.js";
import {
  clearPendingAuthCheck,
  ALLOWED_EMAIL_DOMAIN,
} from "./lib/appwrite/auth.js";
import clientConfig from "./config/client.js";
import "./App.css";

const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const FacultyDirectoryPage = lazy(
  () => import("./pages/FacultyDirectoryPage.jsx"),
);
const FacultyDetailPage = lazy(() => import("./pages/FacultyDetailPage.jsx"));
const UserDashboardPage = lazy(() => import("./pages/UserDashboardPage.jsx"));
const RankingPage = lazy(() => import("./pages/RankingPage.jsx"));
const PollPage = lazy(() => import("./pages/PollPage.jsx"));
const ContactPage = lazy(() => import("./pages/ContactPage.jsx"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage.jsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.jsx"));

function App() {
  const dispatch = useDispatch();
  const location = useLocation();

  // Redux selectors
  const {
    currentUser,
    authChecked,
    authError,
    showLoginOverlay,
    loginInProgress,
  } = useSelector((state) => state.auth);
  const { theme, showNavbar, isSetupMode, setupChecked } = useSelector(
    (state) => state.ui,
  );

  useEffect(() => {
    checkDatabaseAccess();
    dispatch(loadCurrentUser());
  }, [dispatch]);

  // Set initial theme on document element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pageUrl = new URL(window.location.href);
    if (pageUrl.searchParams.get("auth") !== "failed") return;
    dispatch(
      setAuthError(
        `Login failed. Please sign in using your @${ALLOWED_EMAIL_DOMAIN} account.`,
      ),
    );
    dispatch(setShowLoginOverlay(true));
    clearPendingAuthCheck();
    pageUrl.searchParams.delete("auth");
    const cleanUrl = `${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`;
    window.history.replaceState({}, "", cleanUrl);
  }, [dispatch]);

  useEffect(() => {
    // Show navbar by default on non-landing pages
    if (location.pathname !== "/") {
      dispatch(setShowNavbar(true));
      return;
    }

    // For landing page, show navbar on scroll
    const handleScroll = () => {
      dispatch(setShowNavbar(window.scrollY > 50));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname, dispatch]);

  const checkDatabaseAccess = async () => {
    try {
      await publicFacultyService.getFacultyList({ limit: 1 });
      dispatch(setIsSetupMode(false));
    } catch {
      dispatch(setIsSetupMode(true));
    } finally {
      dispatch(setSetupChecked(true));
    }
  };

  const handleGoogleLogin = async () => {
    dispatch(googleSignIn());
  };

  const handleLogout = async () => {
    dispatch(logout());
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
      <div className="grid min-h-screen place-items-center bg-(--bg) text-(--text) transition-colors duration-300">
        <div className="animate-fadeIn text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-(--panel) border-t-(--primary)"></div>
          <p className="text-sm text-(--muted)">Setting things up for you...</p>
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
          onOpenLoginOverlay={() => dispatch(setShowLoginOverlay(true))}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={() => dispatch(toggleTheme())}
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
              <Route
                path="/dashboard"
                element={
                  currentUser ? (
                    <UserDashboardPage
                      currentUser={currentUser}
                      onLogout={handleLogout}
                    />
                  ) : (
                    <Navigate to="/faculty" replace />
                  )
                }
              />
              <Route
                path="/rankings"
                element={<RankingPage currentUser={currentUser} />}
              />
              <Route path="/polls" element={<PollPage />} />
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
        onClose={() => dispatch(setShowLoginOverlay(false))}
        authError={authError}
        onSignIn={handleGoogleLogin}
        signingIn={loginInProgress}
      />
      <ToastContainer />
    </div>
  );
}

export default App;
