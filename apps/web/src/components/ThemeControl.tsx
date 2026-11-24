import { useTheme } from "../ThemeProvider";

export function ThemeControl() {
  const { resolved, setPreference } = useTheme();
  return (
    <div className="theme-segmented" role="group" aria-label="Appearance">
      <button
        type="button"
        className={`theme-segment${resolved === "dark" ? " is-active" : ""}`}
        aria-pressed={resolved === "dark"}
        onClick={() => setPreference("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        className={`theme-segment${resolved === "light" ? " is-active" : ""}`}
        aria-pressed={resolved === "light"}
        onClick={() => setPreference("light")}
      >
        Light
      </button>
    </div>
  );
}
