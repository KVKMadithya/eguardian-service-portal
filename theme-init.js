/* global tailwind */
"use strict";

/* Loaded synchronously in <head>, after the Tailwind CDN script and before first paint.
   Enables class-based dark mode and applies the saved (or system) theme so the page
   never flashes the wrong colours on load. Must stay in sync with THEME_STORAGE_KEY in app.js. */
(function initTheme() {
  if (typeof tailwind !== "undefined") {
    tailwind.config = { darkMode: "class" };
  }

  let theme = null;
  try {
    theme = window.localStorage.getItem("eguardian_theme_v1");
  } catch (_err) {
    theme = null;
  }
  if (theme !== "light" && theme !== "dark") {
    const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }
  document.documentElement.classList.toggle("dark", theme === "dark");

  // Match the mobile browser chrome to the canvas colour (kept in sync by applyTheme() in app.js).
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", theme === "dark" ? "#090b10" : "#f8fafc");
})();
