import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  deleteUser,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./client.js";

export const ALLOWED_EMAIL_DOMAIN = "vitapstudent.ac.in";

function parseLegacyUserIdMap() {
  const raw = String(import.meta.env.VITE_LEGACY_USER_ID_MAP || "").trim();
  if (!raw) return Object.freeze({});
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return Object.freeze({});
    const normalized = {};
    for (const [email, userId] of Object.entries(parsed)) {
      const safeEmail = String(email || "").trim().toLowerCase();
      const safeUserId = String(userId || "").trim();
      if (!safeEmail || !safeUserId) continue;
      normalized[safeEmail] = safeUserId;
    }
    return Object.freeze(normalized);
  } catch {
    return Object.freeze({});
  }
}

function parseExplicitlyAllowedEmails() {
  const raw = String(import.meta.env.VITE_EXPLICIT_ALLOWED_EMAILS || "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((row) => String(row || "").trim().toLowerCase())
      .filter(Boolean),
  );
}

const LEGACY_USER_ID_BY_EMAIL = parseLegacyUserIdMap();
const EXPLICITLY_ALLOWED_EMAILS = parseExplicitlyAllowedEmails();

function getAssignedUserId(user) {
  const email = String(user?.email || "")
    .trim()
    .toLowerCase();
  if (email && Object.hasOwn(LEGACY_USER_ID_BY_EMAIL, email)) {
    return LEGACY_USER_ID_BY_EMAIL[email];
  }
  return String(user?.uid || "").trim();
}

function normalizeUser(user) {
  if (!user) return null;

  const createdAt =
    user?.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : null;
  const updatedAt =
    user?.metadata?.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).toISOString()
      : createdAt;

  return {
    $id: getAssignedUserId(user),
    uid: String(user.uid || "").trim(),
    email: user.email || "",
    name: user.displayName || user.email || "User",
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
    $createdAt: createdAt,
    $updatedAt: updatedAt,
  };
}

function isAllowedEmailInternal(email) {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (EXPLICITLY_ALLOWED_EMAILS.has(normalized)) return true;
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false;
  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (domain !== ALLOWED_EMAIL_DOMAIN) return false;

  // Explicitly disallow PhD-format student emails such as:
  // name.23phd123@vitapstudent.ac.in
  if (/\.\d{2}phd/i.test(localPart)) return false;

  return true;
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

export function hasPendingAuthCheck() {
  return getAuthCheckFlag();
}

export function clearPendingAuthCheck() {
  setAuthCheckFlag(false);
}

export class AuthService {
  authInitialized = false;
  initError = null;
  currentUser = null;
  hasResolvedInitialAuthState = false;
  resolveInitialAuthState = null;
  initialAuthStatePromise = null;

  constructor() {
    // Firebase auth is already initialized from client.js
    this.authInitialized = true;
    this.initialAuthStatePromise = new Promise((resolve) => {
      this.resolveInitialAuthState = resolve;
    });

    // Set up auth state listener
    onAuthStateChanged(auth, (user) => {
      this.currentUser = normalizeUser(user);
      if (!this.hasResolvedInitialAuthState) {
        this.hasResolvedInitialAuthState = true;
        this.resolveInitialAuthState?.();
      }
    });
  }

  async waitForInitialAuthState(timeoutMs = 3000) {
    if (this.hasResolvedInitialAuthState) return;

    await Promise.race([
      this.initialAuthStatePromise,
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  // Google OAuth sign in
  async googleSignIn() {
    if (!this.authInitialized) {
      throw new Error(this.initError || "Firebase service not initialized");
    }

    try {
      setAuthCheckFlag(true);
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check email domain
      if (!isAllowedEmailInternal(user.email)) {
        await signOut(auth);
        setAuthCheckFlag(false);
        const error = new Error(
          `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
        );
        error.type = "disallowed_email_domain";
        throw error;
      }

      return normalizeUser(user);
    } catch (error) {
      throw error;
    }
  }

  // Get current user
  async getCurrentUser() {
    if (!this.authInitialized) {
      return null;
    }

    try {
      // On reload Firebase may restore the persisted session asynchronously.
      await this.waitForInitialAuthState();
      const user = auth.currentUser;

      if (!user) {
        setAuthCheckFlag(false);
        return null;
      }

      if (!isAllowedEmailInternal(user.email)) {
        await signOut(auth);
        setAuthCheckFlag(false);
        const error = new Error(
          `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
        );
        error.type = "disallowed_email_domain";
        throw error;
      }

      // User is valid, make sure flag is set
      setAuthCheckFlag(true);
      return normalizeUser(user);
    } catch (error) {
      if (
        String(error?.type || "").toLowerCase() === "disallowed_email_domain"
      ) {
        throw error;
      }
      return null;
    }
  }

  // Logout
  async logout() {
    if (!this.authInitialized) {
      setAuthCheckFlag(false);
      return true;
    }

    try {
      await signOut(auth);
      setAuthCheckFlag(false);
      this.currentUser = null;
      return true;
    } catch (error) {
      throw error;
    }
  }

  async deleteCurrentAccount() {
    if (!this.authInitialized) {
      throw new Error(this.initError || "Firebase service not initialized");
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user is currently logged in");
    }

    try {
      await deleteUser(user);
      setAuthCheckFlag(false);
      this.currentUser = null;
      return true;
    } catch (error) {
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
