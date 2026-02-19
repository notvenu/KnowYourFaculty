import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice.js";
import uiReducer from "./uiSlice.js";
import facultyReducer from "./facultySlice.js";
import coursesReducer from "./coursesSlice.js";
import feedbackReducer from "./feedbackSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    faculty: facultyReducer,
    courses: coursesReducer,
    feedback: feedbackReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["auth/loadCurrentUser/fulfilled"],
        // Ignore these field paths in all actions
        ignoredActionPaths: ["payload.user"],
        // Ignore these paths in the state
        ignoredPaths: ["auth.currentUser"],
      },
    }),
});

export default store;
