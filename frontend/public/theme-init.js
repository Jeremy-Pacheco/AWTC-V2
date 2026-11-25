// Applies the dark mode class before React loads, so the page does not flash.
// Kept as a static file (not an inline <script>) so it works under the
// backend's Content-Security-Policy when Express serves the built SPA.
(function () {
  try {
    var saved = localStorage.getItem("darkMode");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "true" || (saved === null && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    /* storage unavailable: keep the light theme */
  }
})();
