/* global localStorage, matchMedia, document */
/* Parser-blocking, same-origin theme initialization before the first painted frame.
 * Keep in sync with src/theme.ts; no DOM ready listener or module/defer/async.
 * Obsidian Command defaults initial paint to dark unless light is explicitly selected.
 */
(function () {
  var preference = "dark";
  try {
    var stored = localStorage.getItem("diagnostic-odyssey.theme");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch { /* Storage is optional. */ }
  var systemDark = true;
  try { systemDark = matchMedia("(prefers-color-scheme: dark)").matches; } catch { /* Dark fallback. */ }
  var resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]').content = resolved === "dark" ? "#0a0b0e" : "#f4f3ee";
})();
