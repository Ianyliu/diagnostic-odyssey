import { useTheme } from "../ThemeProvider";

export function ThemeControl() {
  const { resolved, setPreference } = useTheme();
  const nextTheme = resolved === "dark" ? "light" : "dark";
  const label = resolved === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="theme-icon-toggle"
      onClick={() => setPreference(nextTheme)}
      aria-label={label}
      title={label}
      data-theme-state={resolved}
    >
      {resolved === "dark" ? (
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <circle cx="10" cy="10" r="3.6" />
          <path d="M10 2.2v2.1M10 15.7v2.1M2.2 10h2.1M15.7 10h2.1M4.5 4.5l1.5 1.5M14 14l1.5 1.5M15.5 4.5L14 6M6 14l-1.5 1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M16.2 12.6A6.8 6.8 0 0 1 7.4 3.8a7.2 7.2 0 1 0 8.8 8.8Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
