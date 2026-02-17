import clientConfig from "../../config/client.js";
import { Client, Account, OAuthProvider } from "appwrite";

export const ALLOWED_EMAIL_DOMAIN = "vitapstudent.ac.in";

function isAllowedEmailInternal(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

const AUTH_CHECK_KEY = "kyf_auth_check";

function hasStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function getAuthCheckFlag() {
  if (!hasStorage()) return false;
  return window.localStorage.getItem(AUTH_CHECK_KEY) === "1";
}

function setAuthCheckFlag(enabled) {
  if (!hasStorage()) return;
  if (enabled) {
    window.localStorage.setItem(AUTH_CHECK_KEY, "1");
  } else {
    window.localStorage.removeItem(AUTH_CHECK_KEY);
  }
}

function getCurrentRouteUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function getFailureRouteUrl() {
  if (typeof window === "undefined") return "/";
  const failureUrl = new URL(getCurrentRouteUrl());
  failureUrl.searchParams.set("auth", "failed");
  return failureUrl.toString();
}

export function hasPendingAuthCheck() {
  return getAuthCheckFlag();
}

export function clearPendingAuthCheck() {
  setAuthCheckFlag(false);
}

export class AuthService {
  client = new Client();
  account;
  initialized = false;
  initError = null;

  constructor() {
    // Validate required configuration
    if (!clientConfig.appwriteUrl || !clientConfig.appwriteProjectId) {
      this.initError = `Missing Appwrite configuration. URL: ${!!clientConfig.appwriteUrl}, ProjectID: ${!!clientConfig.appwriteProjectId}`;
      console.error("AuthService initialization failed:", this.initError);
      return;
    }

    try {
      this.client
        .setEndpoint(clientConfig.appwriteUrl)
        .setProject(clientConfig.appwriteProjectId);
      this.account = new Account(this.client);
      this.initialized = true;
    } catch (error) {
      this.initError = error?.message || "Failed to initialize Appwrite client";
      console.error("AuthService initialization error:", error);
    }
  }

  // Google OAuth sign in
  async googleSignIn() {
    if (!this.initialized || !this.account) {
      throw new Error(this.initError || "Appwrite service not initialized");
    }
    try {
      setAuthCheckFlag(true);
      const session = await this.account.createOAuth2Session(
        OAuthProvider.Google,
        getCurrentRouteUrl(),
        getFailureRouteUrl(),
      );
      return session;
    } catch (error) {
      console.error("Google sign in error:", error);
      throw error;
    }
  }

  // Get current user
  async getCurrentUser() {
    if (!this.initialized || !this.account) {
      console.debug("Appwrite service not initialized, returning null");
      return null;
    }
    try {
      const user = await this.account.get();
      if (!isAllowedEmailInternal(user?.email)) {
        await this.account.deleteSessions();
        setAuthCheckFlag(false);
        const error = new Error(
          `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
        );
        error.type = "disallowed_email_domain";
        throw error;
      }
      // User is valid, make sure flag is set
      setAuthCheckFlag(true);
      return user;
    } catch (error) {
      if (
        String(error?.type || "").toLowerCase() === "disallowed_email_domain"
      ) {
        throw error;
      }
      const code = Number(error?.code || 0);
      const type = String(error?.type || "");
      const isExpectedGuest401 =
        code === 401 || type.includes("general_unauthorized_scope");
      if (!isExpectedGuest401) {
        console.error("Get current user error:", error);
      }
      return null;
    }
  }

  // Logout
  async logout() {
    if (!this.initialized || !this.account) {
      setAuthCheckFlag(false);
      return true;
    }
    try {
      await this.account.deleteSession("current");
      setAuthCheckFlag(false);
      return true;
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  // Check if user is logged in
  async isLoggedIn() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  isAllowedEmail(email) {
    return isAllowedEmailInternal(email);
  }
}

const authService = new AuthService();
export default authService;
