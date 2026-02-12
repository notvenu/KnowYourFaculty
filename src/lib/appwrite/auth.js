import clientConfig from "../../config/client.js";
import { Client, Account, OAuthProvider } from "appwrite";

export const ALLOWED_EMAIL_DOMAIN = "vitapstudent.ac.in";
const EXTRA_ALLOWED_EMAILS = new Set(
    String(import.meta.env.VITE_ALLOWED_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
);

function isAllowedEmailInternal(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) return true;
    return EXTRA_ALLOWED_EMAILS.has(normalized);
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

export class AuthService {
    client = new Client();
    account;
    
    constructor() {
        this.client
            .setEndpoint(clientConfig.appwriteUrl)
            .setProject(clientConfig.appwriteProjectId);
        this.account = new Account(this.client);
    }
    
    // Google OAuth sign in
    async googleSignIn() {
        try {
            setAuthCheckFlag(true);
            const session = await this.account.createOAuth2Session(
                OAuthProvider.Google,
                `${window.location.origin}/`, // Success URL
                `${window.location.origin}/` // Failure URL
            );
            return session;
        } catch (error) {
            console.error('Google sign in error:', error);
            throw error;
        }
    }

    // Get current user
    async getCurrentUser() {
        try {
            if (!getAuthCheckFlag()) {
                return null;
            }

            const user = await this.account.get();
            if (!isAllowedEmailInternal(user?.email)) {
                await this.account.deleteSessions();
                setAuthCheckFlag(false);
                return null;
            }
            return user;
        } catch (error) {
            const code = Number(error?.code || 0);
            const type = String(error?.type || "");
            const isExpectedGuest401 =
                code === 401 ||
                type.includes("general_unauthorized_scope");
            if (isExpectedGuest401) {
                setAuthCheckFlag(false);
            }
            if (!isExpectedGuest401) {
                console.error('Get current user error:', error);
            }
            return null;
        }
    }

    // Logout
    async logout() {
        try {
            await this.account.deleteSession('current');
            setAuthCheckFlag(false);
            return true;
        } catch (error) {
            console.error('Logout error:', error);
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
