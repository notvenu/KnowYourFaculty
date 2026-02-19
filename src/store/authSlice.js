import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import authService, {
  clearPendingAuthCheck,
  hasPendingAuthCheck,
  ALLOWED_EMAIL_DOMAIN,
} from "../lib/appwrite/auth.js";
import accountDeletionService from "../services/accountDeletionService.js";
import facultyFeedbackService from "../services/facultyFeedbackService.js";

// Async thunks
export const loadCurrentUser = createAsyncThunk(
  "auth/loadCurrentUser",
  async (_, { rejectWithValue }) => {
    let retries = 0;
    const maxRetries = 3;

    const tryLoadUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          if (hasPendingAuthCheck()) {
            clearPendingAuthCheck();
            return rejectWithValue(
              `Login failed. Please sign in using your @${ALLOWED_EMAIL_DOMAIN} account.`,
            );
          }
          return null;
        }

        if (!authService.isAllowedEmail(user.email)) {
          await authService.logout();
          return rejectWithValue(
            `Only @${ALLOWED_EMAIL_DOMAIN} email accounts are allowed.`,
          );
        }

        try {
          const deletionResult =
            await accountDeletionService.processDueDeletion({
              user,
              authService,
              feedbackService: facultyFeedbackService,
            });
          if (deletionResult?.deleted) {
            return rejectWithValue(
              deletionResult.message ||
                "Your account was deleted after the scheduled timeout.",
            );
          }
        } catch (deletionError) {
          console.error("Scheduled deletion processing failed:", deletionError);
        }

        return user;
      } catch (error) {
        const errorType = String(error?.type || "").toLowerCase();
        if (errorType === "disallowed_email_domain") {
          clearPendingAuthCheck();
          return rejectWithValue(
            `Login failed. Please sign in using your @${ALLOWED_EMAIL_DOMAIN} account.`,
          );
        }

        if (retries >= maxRetries) {
          return rejectWithValue("Unable to verify login state.");
        }

        retries++;
        await new Promise((resolve) => setTimeout(resolve, 300));
        return await tryLoadUser();
      }
    };

    return await tryLoadUser();
  },
);

export const googleSignIn = createAsyncThunk(
  "auth/googleSignIn",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      await authService.googleSignIn();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await dispatch(loadCurrentUser());
      return true;
    } catch {
      return rejectWithValue(
        "Google login failed. Check Appwrite OAuth settings.",
      );
    }
  },
);

export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return true;
    } catch {
      return rejectWithValue("Logout failed. Please try again.");
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    currentUser: null,
    authChecked: false,
    authError: null,
    loginInProgress: false,
    showLoginOverlay: false,
  },
  reducers: {
    setShowLoginOverlay: (state, action) => {
      state.showLoginOverlay = action.payload;
    },
    setAuthError: (state, action) => {
      state.authError = action.payload;
    },
    clearAuthError: (state) => {
      state.authError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // loadCurrentUser
      .addCase(loadCurrentUser.pending, (state) => {
        state.authChecked = false;
      })
      .addCase(loadCurrentUser.fulfilled, (state, action) => {
        state.currentUser = action.payload;
        state.authChecked = true;
        state.authError = null;
        if (action.payload) {
          state.showLoginOverlay = false;
        }
      })
      .addCase(loadCurrentUser.rejected, (state, action) => {
        state.currentUser = null;
        state.authChecked = true;
        state.authError = action.payload;
        state.showLoginOverlay = true;
      })
      // googleSignIn
      .addCase(googleSignIn.pending, (state) => {
        state.loginInProgress = true;
        state.authError = null;
      })
      .addCase(googleSignIn.fulfilled, (state) => {
        state.loginInProgress = false;
      })
      .addCase(googleSignIn.rejected, (state, action) => {
        state.loginInProgress = false;
        state.authError = action.payload;
      })
      // logout
      .addCase(logout.fulfilled, (state) => {
        state.currentUser = null;
        state.authError = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.authError = action.payload;
      });
  },
});

export const { setShowLoginOverlay, setAuthError, clearAuthError } =
  authSlice.actions;
export default authSlice.reducer;
