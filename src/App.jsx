import { useState, useEffect } from "react";
import "./App.css";
import FacultyList from "./components/FacultyList.jsx";
import SetupHelper from "./components/SetupHelper.jsx";
import publicFacultyService from "./services/publicFacultyService.js";
import authService, { ALLOWED_EMAIL_DOMAIN } from "./lib/appwrite/auth.js";

function App() {
  const [isSetupMode, setIsSetupMode] = useState(true);
  const [setupChecked, setSetupChecked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkDatabaseAccess();
    loadCurrentUser();
  }, []);

  const checkDatabaseAccess = async () => {
    try {
      await publicFacultyService.getFacultyList({ limit: 1 });
      setIsSetupMode(false);
    } catch (error) {
      if (error.message.includes("not authorized") || error.code === 401) {
        setIsSetupMode(true);
      } else {
        setIsSetupMode(true);
      }
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
        setAuthError(`Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`);
        return;
      }

      setCurrentUser(user);
    } catch (error) {
      setAuthError("Unable to verify login state.");
    } finally {
      setAuthChecked(true);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError(null);
      await authService.googleSignIn();
    } catch (error) {
      setAuthError("Google login failed. Check Appwrite OAuth settings.");
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setCurrentUser(null);
    } catch (error) {
      setAuthError("Logout failed. Please try again.");
    }
  };

  if (!setupChecked || !authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking system configuration...</p>
        </div>
      </div>
    );
  }

  if (isSetupMode) {
    return <SetupHelper />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-3 py-4 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">Faculty</span>
              <h1 className="text-xl font-bold text-gray-800">Know Your Faculty</h1>
              <span className="text-sm text-gray-500 bg-green-100 px-2 py-1 rounded-full">
                Live Data
              </span>
            </div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <span className="text-sm text-gray-700">
                    {currentUser.name || currentUser.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Login with Google
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto">
        <FacultyList />
        {!currentUser && authError ? (
          <div className="px-4 pb-4">
            <p className="text-sm text-red-600 text-center">{authError}</p>
          </div>
        ) : null}
      </main>

      <footer className="mt-12 py-6 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <div className="flex items-center justify-center space-x-4 text-sm">
            <span>Automatically updated every Sunday at 1:00 AM</span>
            <span>-</span>
            <span>VIT-AP University Faculty Directory</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Built for VIT-AP University. Last updated: Auto-sync enabled.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
