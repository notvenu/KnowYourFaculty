import clientConfig from "../../config/client.js";
import { supabase, isSupabaseConfigured } from "../supabase/client.js";

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
  return new Set(clientConfig.explicitAllowedEmails || []);
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
  return String(user?.id || "").trim();
}

function normalizeUser(user) {
  if (!user) return null;

  const createdAt = user?.created_at || null;
  const updatedAt = user?.last_sign_in_at || createdAt;
  const metadata = user.user_metadata || {};

  return {
    $id: getAssignedUserId(user),
    uid: String(user.id || "").trim(),
    email: user.email || "",
    name:
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      user.email ||
      "User",
    displayName: metadata.full_name || metadata.name || "",
    photoURL: metadata.avatar_url || metadata.picture || "",
    emailVerified: Boolean(user.email_confirmed_at),
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
  if (/\.\d{2}phd/i.test(localPart)) return false;
  return true;
}

const AUTH_CHECK_KEY = "kyf_auth_check";
const SESSION_START_KEY = "kyf_session_started_at";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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

function getSessionStartedAt() {
  if (!hasStorage()) return null;
  const raw = window.localStorage.getItem(SESSION_START_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function setSessionStartedAt(timestamp = Date.now()) {
  if (!hasStorage()) return;
  window.localStorage.setItem(SESSION_START_KEY, String(timestamp));
}

function clearSessionStartedAt() {
  if (!hasStorage()) return;
  window.localStorage.removeItem(SESSION_START_KEY);
}

function isSessionExpired() {
  const startedAt = getSessionStartedAt();
  if (!startedAt) return false;
  return Date.now() - startedAt > SESSION_MAX_AGE_MS;
}

export function hasPendingAuthCheck() {
  return getAuthCheckFlag();
}

export function clearPendingAuthCheck() {
  setAuthCheckFlag(false);
}

export class AuthService {
  authInitialized = isSupabaseConfigured;
  initError = null;
  currentUser = null;
  hasResolvedInitialAuthState = false;
  resolveInitialAuthState = null;
  initialAuthStatePromise = null;

  constructor() {
    if (!this.authInitialized || !supabase) {
      this.initError = "Supabase auth is not configured";
      this.hasResolvedInitialAuthState = true;
      this.initialAuthStatePromise = Promise.resolve();
      return;
    }

    this.initialAuthStatePromise = new Promise((resolve) => {
      this.resolveInitialAuthState = resolve;
    });

    supabase.auth
      .getUser()
      .then(({ data }) => {
        this.currentUser = normalizeUser(data?.user || null);
      })
      .finally(() => {
        if (!this.hasResolvedInitialAuthState) {
          this.hasResolvedInitialAuthState = true;
          this.resolveInitialAuthState?.();
        }
      });

    supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser = normalizeUser(session?.user || null);
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

  async googleSignIn() {
    if (!this.authInitialized || !supabase) {
      throw new Error(this.initError || "Supabase auth not initialized");
    }

    setAuthCheckFlag(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}${window.location.search}`
        : clientConfig.siteUrl;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          hd: ALLOWED_EMAIL_DOMAIN,
        },
      },
    });

    if (error) {
      setAuthCheckFlag(false);
      clearSessionStartedAt();
      throw error;
    }

    return true;
  }

  async getCurrentUser() {
    if (!this.authInitialized || !supabase) {
      return null;
    }

    await this.waitForInitialAuthState();
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const user = data?.user || null;

    if (!user) {
      setAuthCheckFlag(false);
      clearSessionStartedAt();
      return null;
    }

    if (isSessionExpired()) {
      await supabase.auth.signOut();
      setAuthCheckFlag(false);
      clearSessionStartedAt();
      const sessionError = new Error("Session expired. Please sign in again.");
      sessionError.type = "session_expired";
      throw sessionError;
    }

    if (!getSessionStartedAt()) {
      setSessionStartedAt(Date.now());
    }

    if (!isAllowedEmailInternal(user.email)) {
      await supabase.auth.signOut();
      setAuthCheckFlag(false);
      clearSessionStartedAt();
      const domainError = new Error(
        `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
      );
      domainError.type = "disallowed_email_domain";
      throw domainError;
    }

    setAuthCheckFlag(true);
    this.currentUser = normalizeUser(user);
    return this.currentUser;
  }

  async logout() {
    if (!supabase) {
      setAuthCheckFlag(false);
      return true;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAuthCheckFlag(false);
    clearSessionStartedAt();
    this.currentUser = null;
    return true;
  }

  async deleteCurrentAccount() {
    if (!supabase) {
      throw new Error(this.initError || "Supabase auth not initialized");
    }

    const rpcName = String(clientConfig.supabaseDeleteAccountRpc || "").trim();
    if (!rpcName) {
      throw new Error(
        "Account deletion RPC is not configured. Set VITE_SUPABASE_DELETE_ACCOUNT_RPC.",
      );
    }

    const { error } = await supabase.rpc(rpcName);
    if (error) {
      throw new Error(
        error.message ||
          "Failed to delete the current account. Check your Supabase RPC setup.",
      );
    }

    await supabase.auth.signOut();
    setAuthCheckFlag(false);
    clearSessionStartedAt();
    this.currentUser = null;
    return true;
  }

  async isLoggedIn() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  isAllowedEmail(email) {
    return isAllowedEmailInternal(email);
  }
}

const authService = new AuthService();
export default authService;
