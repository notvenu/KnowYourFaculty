import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import { loadCurrentUser } from "./store/authSlice.js";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./lib/firebase/client.js";
import "./index.css";
import App from "./App.jsx";

// Start auth check immediately before React renders to minimize the delay
// where the app shows the user as logged out.
store.dispatch(loadCurrentUser());

// Subscribe to Firebase auth state changes as a fallback for cases where the
// initial loadCurrentUser call times out before Firebase resolves the session
// (e.g. slow networks requiring a token refresh). When Firebase eventually
// fires with a user but our Redux state has no user, re-dispatch the check.
// This only handles the initial page load — subsequent auth changes are
// managed by the Redux store and app-level login/logout flows.
let unsubscribeAuthListener;
unsubscribeAuthListener = onAuthStateChanged(auth, (firebaseUser) => {
  if (unsubscribeAuthListener) unsubscribeAuthListener();
  if (firebaseUser) {
    const { auth: authState } = store.getState();
    if (authState.authChecked && !authState.currentUser) {
      store.dispatch(loadCurrentUser());
    }
  }
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
