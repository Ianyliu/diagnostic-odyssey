import { useTheme } from "../ThemeProvider";
import type { ThemePreference } from "../theme";

export function ThemeControl() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <label className="theme-select-wrap" data-theme-state={resolved}>
      <span className="theme-select-icon" aria-hidden="true">
        {resolved === "dark" ? (
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M16.2 12.6A6.8 6.8 0 0 1 7.4 3.8a7.2 7.2 0 1 0 8.8 8.8Z" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7">
            <circle cx="10" cy="10" r="3.6" />
            <path d="M10 2.2v2.1M10 15.7v2.1M2.2 10h2.1M15.7 10h2.1M4.5 4.5l1.5 1.5M14 14l1.5 1.5M15.5 4.5L14 6M6 14l-1.5 1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <select
        className="theme-select"
        aria-label="Appearance"
        value={preference}
        onChange={event => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
