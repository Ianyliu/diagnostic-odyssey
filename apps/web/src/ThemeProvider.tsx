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
import { getBrowserMediaQuery, readMediaQueryMatches, subscribeToMediaQuery } from "./browserMedia";

const systemThemeQuery = "(prefers-color-scheme: dark)";

interface ThemeValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function systemIsDark(): boolean {
  return readMediaQueryMatches(getBrowserMediaQuery(systemThemeQuery));
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
    const media = getBrowserMediaQuery(systemThemeQuery);
    const onMediaChange = () => setDarkSystem(readMediaQueryMatches(media));
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        updatePreference(parseThemePreference(event.newValue));
      }
    };
    const unsubscribeMedia = subscribeToMediaQuery(media, onMediaChange);
    onMediaChange();
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribeMedia();
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
