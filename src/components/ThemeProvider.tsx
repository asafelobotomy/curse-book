import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../lib/api";
import {
  applyTheme,
  DEFAULT_THEME_ID,
  getTheme,
  THEMES,
  type ThemeDefinition,
} from "../lib/themes";

interface ThemeContextValue {
  themeId: string;
  theme: ThemeDefinition;
  themes: ThemeDefinition[];
  setThemeId: (id: string) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    applyTheme(DEFAULT_THEME_ID);
    api
      .getSetting("theme")
      .then((stored) => {
        if (stored && THEMES.some((t) => t.id === stored)) {
          setThemeIdState(stored);
          applyTheme(stored);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setThemeId = useCallback(async (id: string) => {
    setThemeIdState(id);
    applyTheme(id);
    try {
      await api.setSetting("theme", id);
    } catch {
      // non-Tauri preview
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme: getTheme(themeId),
        themes: THEMES,
        setThemeId,
        loading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
