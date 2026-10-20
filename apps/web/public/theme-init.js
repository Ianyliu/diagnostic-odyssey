/* Parser-blocking, same-origin theme initialization before the first painted frame.
 * Keep in sync with src/theme.ts; no DOM ready listener or module/defer/async.
 */
(function () {
  var preference = "system";
  try {
    var stored = localStorage.getItem("diagnostic-odyssey.theme");
    if (stored === "light" || stored === "dark" || stored === "system") preference = stored;
  } catch (_) { /* Storage is optional. */ }
  var systemDark = false;
  try { systemDark = matchMedia("(prefers-color-scheme: dark)").matches; } catch (_) { /* Light fallback. */ }
  var resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]').content = resolved === "dark" ? "#09131b" : "#f5f2eb";
})();
