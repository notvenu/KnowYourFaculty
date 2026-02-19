import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    theme: (() => {
      const saved = localStorage.getItem("kyf-theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    })(),
    showNavbar: false,
    isSetupMode: true,
    setupChecked: false,
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      document.documentElement.setAttribute("data-theme", action.payload);
      localStorage.setItem("kyf-theme", action.payload);
    },
    toggleTheme: (state) => {
      const newTheme = state.theme === "dark" ? "light" : "dark";
      state.theme = newTheme;
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("kyf-theme", newTheme);
    },
    setShowNavbar: (state, action) => {
      state.showNavbar = action.payload;
    },
    setIsSetupMode: (state, action) => {
      state.isSetupMode = action.payload;
    },
    setSetupChecked: (state, action) => {
      state.setupChecked = action.payload;
    },
  },
});

export const {
  setTheme,
  toggleTheme,
  setShowNavbar,
  setIsSetupMode,
  setSetupChecked,
} = uiSlice.actions;
export default uiSlice.reducer;
