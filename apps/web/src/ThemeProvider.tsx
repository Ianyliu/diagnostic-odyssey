import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  THEME_STORAGE_KEY,
  getThemeStorage,
  parseThemePreference,
  persistThemePreference,
  readThemePreference,
  resolveTheme
} from "./theme";
import type { ThemePreference, ResolvedTheme } from "./theme";

interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemIsDark(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, updatePreference] = useState<ThemePreference>(() =>
    readThemePreference(getThemeStorage())
  );
  const [darkSystem, setDarkSystem] = useState(systemIsDark);
  const resolved = resolveTheme(preference, darkSystem);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
  }, [preference, resolved]);

  useEffect(() => {
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const onMediaChange = () => setDarkSystem(media?.matches ?? false);
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        updatePreference(parseThemePreference(event.newValue));
      }
    };
    media?.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    updatePreference(next);
    persistThemePreference(getThemeStorage(), next);
  };

  return <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
    {children}
  </ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("ThemeProvider is missing");
  return theme;
}
