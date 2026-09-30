import { useTheme } from "../ThemeProvider";
import type { ThemePreference } from "../theme";

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  return <label className="theme-control">
    <span>Appearance</span>
    <select
      aria-label="Appearance"
      value={preference}
      onChange={event => setPreference(event.target.value as ThemePreference)}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>;
}
