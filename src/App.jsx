import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import SiteNav from "./components/layout/SiteNav.jsx";
import SiteFooter from "./components/layout/SiteFooter.jsx";
import {
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
import websiteFeedbackService from "./services/websiteFeedbackService.js";
import "./App.css";
import { Analytics } from "@vercel/analytics/react";

const SetupHelper = lazy(() => import("./components/admin/SetupHelper.jsx"));
const AdminPanel = lazy(() => import("./components/admin/AdminPanel.jsx"));
const LoginOverlay = lazy(
  () => import("./components/overlays/LoginOverlay.jsx"),
);
const WebsiteFeedbackOverlay = lazy(
  () => import("./components/overlays/WebsiteFeedbackOverlay.jsx"),
);
const ToastContainer = lazy(() => import("./components/ui/ToastContainer.jsx"));
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
const USER_SEEN_PREFIX = "kyf.userSeen.v1";
const USER_FEEDBACK_DONE_PREFIX = "kyf.userFeedbackDone.v1";

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

function AppShellSkeleton({ fullScreen = false }) {
  return (
    <div
      className={`mx-auto w-full max-w-7xl ${fullScreen ? "min-h-screen" : "min-h-[40vh]"} px-3 py-6 sm:px-6 sm:py-8`}
    >
      <div className="animate-pulse space-y-5">
        <div className="h-9 w-full max-w-md rounded-lg bg-(--panel)" />
        <div className="h-4 w-full max-w-xl rounded bg-(--panel)" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`app-skeleton-card-${index}`}
              className="rounded-xl border border-(--line) bg-(--bg-elev) p-4"
            >
              <div className="mb-3 h-4 w-2/3 rounded bg-(--panel)" />
              <div className="mb-2 h-3 w-full rounded bg-(--panel)" />
              <div className="h-3 w-5/6 rounded bg-(--panel)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollRestoreTimeoutRef = useRef(null);
  const [showWebsiteFeedbackOverlay, setShowWebsiteFeedbackOverlay] =
    useState(false);

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
    let timeoutId = null;
    let idleId = null;

    const runSetupCheck = () => {
      checkDatabaseAccess();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(runSetupCheck, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(runSetupCheck, 1200);
    }

    return () => {
      if (
        idleId &&
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window
      ) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
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
    const matched =
      seoByRoute.find((entry) => entry.test.test(path)) || defaultSeo;
    const canonical = `${SITE_URL}${path}`;
    const isPrivateRoute = path === "/dashboard" || path === "/admin";

    document.title = matched.title;
    upsertHeadMeta({ key: "description", content: matched.description });
    upsertHeadMeta({
      key: "og:title",
      attribute: "property",
      content: matched.title,
    });
    upsertHeadMeta({
      key: "og:description",
      attribute: "property",
      content: matched.description,
    });
    upsertHeadMeta({
      key: "og:url",
      attribute: "property",
      content: canonical,
    });
    upsertHeadMeta({
      key: "twitter:title",
      attribute: "property",
      content: matched.title,
    });
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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const routeKey = `${location.pathname || "/"}${location.search || ""}`;
    const storageKey = `kyf.scroll:${routeKey}`;
    const restoreTo = Number(window.sessionStorage.getItem(storageKey) || 0);

    if (scrollRestoreTimeoutRef.current) {
      clearTimeout(scrollRestoreTimeoutRef.current);
      scrollRestoreTimeoutRef.current = null;
    }

    scrollRestoreTimeoutRef.current = setTimeout(() => {
      if (
        navigationType === "POP" &&
        Number.isFinite(restoreTo) &&
        restoreTo > 0
      ) {
        window.scrollTo(0, restoreTo);
      } else {
        window.scrollTo(0, 0);
      }
      scrollRestoreTimeoutRef.current = null;
    }, 0);

    const saveScroll = () => {
      try {
        window.sessionStorage.setItem(storageKey, String(window.scrollY || 0));
      } catch {
        // ignore storage failures
      }
    };

    const onScroll = () => saveScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      saveScroll();
      window.removeEventListener("scroll", onScroll);
      if (scrollRestoreTimeoutRef.current) {
        clearTimeout(scrollRestoreTimeoutRef.current);
        scrollRestoreTimeoutRef.current = null;
      }
    };
  }, [location.pathname, location.search, navigationType]);

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
    if (typeof window === "undefined") return;
    if (!authChecked || !currentUser?.$id || showLoginOverlay) {
      setShowWebsiteFeedbackOverlay(false);
      return;
    }

    const userId = String(currentUser.$id || "").trim();
    if (!userId) return;

    const seenKey = `${USER_SEEN_PREFIX}:${userId}`;
    const doneKey = `${USER_FEEDBACK_DONE_PREFIX}:${userId}`;

    const alreadySeen = window.localStorage.getItem(seenKey) === "1";
    const alreadyCompleted = window.localStorage.getItem(doneKey) === "1";

    if (!alreadySeen) {
      window.localStorage.setItem(seenKey, "1");
      setShowWebsiteFeedbackOverlay(false);
      return;
    }

    if (alreadyCompleted) {
      setShowWebsiteFeedbackOverlay(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowWebsiteFeedbackOverlay(true);
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [authChecked, currentUser, showLoginOverlay]);

  const completeWebsiteFeedbackPrompt = () => {
    if (typeof window === "undefined") return;
    const userId = String(currentUser?.$id || "").trim();
    if (!userId) return;
    const doneKey = `${USER_FEEDBACK_DONE_PREFIX}:${userId}`;
    window.localStorage.setItem(doneKey, "1");
    setShowWebsiteFeedbackOverlay(false);
  };

  const handleWebsiteFeedbackSubmit = async ({ rating, suggestions }) => {
    await websiteFeedbackService.submitFeedback({
      authUserId: String(currentUser?.uid || "").trim(),
      appUserId: String(currentUser?.$id || "").trim(),
      email: String(currentUser?.email || "").trim(),
      rating,
      suggestions,
      pagePath:
        typeof window !== "undefined" ? window.location.pathname || "/" : "/",
    });

    completeWebsiteFeedbackPrompt();
  };

  useLayoutEffect(() => {
    // Ensure first paint has correct navbar visibility to avoid CLS.
    if (location.pathname !== "/") {
      dispatch(setShowNavbar(true));
      return;
    }

    const handleScroll = () => {
      dispatch(setShowNavbar(window.scrollY > 50));
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname, dispatch]);

  const checkDatabaseAccess = async () => {
    try {
      // Allow slower first-connects on shared/dev networks.
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database check timeout")), 12000),
      );

      const { default: publicFacultyService } =
        await import("./services/publicFacultyService.js");
      await Promise.race([publicFacultyService.ping(), timeoutPromise]);
      dispatch(setIsSetupMode(false));
    } catch (error) {
      // Skip setup mode - app will use sample data if Supabase is unavailable
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

  const isAdminUser = useMemo(() => {
    const email = String(currentUser?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return false;
    const configuredAdmins =
      clientConfig.adminEmails.length > 0
        ? clientConfig.adminEmails
        : clientConfig.explicitAllowedEmails || [];
    return configuredAdmins.includes(email);
  }, [currentUser]);

  const needsAuthCheckForRoute =
    location.pathname === "/dashboard" ||
    location.pathname === "/admin" ||
    location.pathname === "/rankings";
  if (needsAuthCheckForRoute && !authChecked) {
    return (
      <div className="bg-(--bg) text-(--text) transition-colors duration-300">
        <AppShellSkeleton fullScreen />
      </div>
    );
  }

  if (isSetupMode && setupChecked) {
    return (
      <Suspense
        fallback={
          <div className="bg-(--bg) text-(--text)">
            <AppShellSkeleton fullScreen />
          </div>
        }
      >
        <SetupHelper />
      </Suspense>
    );
  }

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
              <AppShellSkeleton />
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
      {showLoginOverlay ? (
        <Suspense fallback={null}>
          <LoginOverlay
            open={showLoginOverlay}
            onClose={() => dispatch(setShowLoginOverlay(false))}
            authError={authError}
            onSignIn={handleGoogleLogin}
            signingIn={loginInProgress}
          />
        </Suspense>
      ) : null}
      {showWebsiteFeedbackOverlay ? (
        <Suspense fallback={null}>
          <WebsiteFeedbackOverlay
            open={showWebsiteFeedbackOverlay}
            onClose={completeWebsiteFeedbackPrompt}
            onSubmit={handleWebsiteFeedbackSubmit}
            userName={currentUser?.name}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={null}>
        <ToastContainer />
      </Suspense>
      <Analytics />
    </div>
  );
}

export default App;
