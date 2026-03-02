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
} from "./lib/firebase/auth.js";
import clientConfig from "./config/client.js";
import "./App.css";
import { Analytics } from "@vercel/analytics/react"

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
const SITE_URL = "https://knowyourfaculty.vercel.app";

function upsertHeadMeta({ key, attribute = "name", content }) {
  if (typeof document === "undefined") return;
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href) {
  if (typeof document === "undefined") return;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

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

  useEffect(() => {
    const path = location.pathname || "/";
    const seoByRoute = [
      {
        test: /^\/$/,
        title: "KnowYourFaculty - Student-Driven Faculty Feedback",
        description:
          "Anonymous faculty feedback from students. Discover teaching quality, reviews, and trends before you choose courses.",
      },
      {
        test: /^\/faculty$/,
        title: "Faculty Directory - KnowYourFaculty",
        description:
          "Browse faculty profiles, departments, and student feedback in one searchable directory.",
      },
      {
        test: /^\/faculty\/[^/]+$/,
        title: "Faculty Profile - KnowYourFaculty",
        description:
          "View faculty ratings, reviews, and student insights to make better academic decisions.",
      },
      {
        test: /^\/rankings$/,
        title: "Faculty Rankings - KnowYourFaculty",
        description:
          "Explore top faculty rankings based on student feedback and review trends.",
      },
      {
        test: /^\/polls$/,
        title: "Faculty Polls - KnowYourFaculty",
        description:
          "Vote and view student polls about faculty strictness and course difficulty.",
      },
      {
        test: /^\/contact$/,
        title: "Contact - KnowYourFaculty",
        description: "Contact the KnowYourFaculty team.",
      },
      {
        test: /^\/privacy-policy$/,
        title: "Privacy Policy - KnowYourFaculty",
        description: "Read the KnowYourFaculty privacy policy.",
      },
      {
        test: /^\/terms-and-conditions$/,
        title: "Terms and Conditions - KnowYourFaculty",
        description: "Read the KnowYourFaculty terms and conditions.",
      },
    ];

    const defaultSeo = {
      title: "KnowYourFaculty - Student-Driven Faculty Feedback",
      description:
        "Discover faculty with real student feedback, anonymous reviews, and ratings.",
    };
    const matched = seoByRoute.find((entry) => entry.test.test(path)) || defaultSeo;
    const canonical = `${SITE_URL}${path}`;
    const isPrivateRoute = path === "/dashboard" || path === "/admin";

    document.title = matched.title;
    upsertHeadMeta({ key: "description", content: matched.description });
    upsertHeadMeta({ key: "og:title", attribute: "property", content: matched.title });
    upsertHeadMeta({
      key: "og:description",
      attribute: "property",
      content: matched.description,
    });
    upsertHeadMeta({ key: "og:url", attribute: "property", content: canonical });
    upsertHeadMeta({ key: "twitter:title", attribute: "property", content: matched.title });
    upsertHeadMeta({
      key: "twitter:description",
      attribute: "property",
      content: matched.description,
    });
    upsertHeadMeta({
      key: "robots",
      content: isPrivateRoute ? "noindex, nofollow" : "index, follow",
    });
    upsertCanonical(canonical);
  }, [location.pathname]);

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
      // Allow slower first-connects on shared/dev networks.
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database check timeout")), 12000)
      );
      
      await Promise.race([
        publicFacultyService.ping(),
        timeoutPromise,
      ]);
      dispatch(setIsSetupMode(false));
    } catch (error) {
      // Skip setup mode - app will use sample data if Firestore unavailable
      dispatch(setIsSetupMode(false));
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

  const needsAuthCheckForRoute =
    location.pathname === "/dashboard" || location.pathname === "/admin";
  if (needsAuthCheckForRoute && !authChecked) {
    return (
      <div className="grid min-h-screen place-items-center bg-(--bg) text-(--text) transition-colors duration-300">
        <div className="animate-fadeIn text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-(--panel) border-t-(--primary)"></div>
          <p className="text-sm text-(--muted)">Setting things up for you...</p>
        </div>
      </div>
    );
  }

  if (isSetupMode && setupChecked) return <SetupHelper />;

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
          showNavbar ? "px-3 py-5 sm:px-6 sm:py-8 lg:px-8" : ""
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
              <Route
                path="/"
                element={
                  <LandingPage
                    onOpenLogin={() => dispatch(setShowLoginOverlay(true))}
                  />
                }
              />
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
      <Analytics />
    </div>
  );
}

export default App;
