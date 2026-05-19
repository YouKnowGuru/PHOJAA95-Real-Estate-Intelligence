import { useContext, createContext, useState, useEffect, type ReactNode } from "react";

type Theme = "dark" | "light" | "system";
type ColorTheme = "emerald" | "blue" | "violet" | "rose" | "amber";

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  colorTheme: "emerald",
  setTheme: () => undefined,
  setColorTheme: () => undefined,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const getInitialTheme = (storageKey: string, defaultTheme: Theme) => {
  if (typeof window === "undefined") return defaultTheme;
  return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
};

const getInitialColorTheme = (storageKey: string) => {
  if (typeof window === "undefined") return "emerald";
  return (localStorage.getItem(`${storageKey}-color`) as ColorTheme) || "emerald";
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  const [themeState, setThemeState] = useState<Theme>(
    () => getInitialTheme(storageKey, defaultTheme)
  );
  const [colorThemeState, setColorThemeState] = useState<ColorTheme>(
    () => getInitialColorTheme(storageKey)
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (themeState === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(themeState);
    }

    // Apply color theme
    root.setAttribute("data-theme", colorThemeState);
  }, [themeState, colorThemeState]);

  useEffect(() => {
    if (themeState !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(e.matches ? "dark" : "light");
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeState]);

  const value = {
    theme: themeState,
    colorTheme: colorThemeState,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setThemeState(theme);
    },
    setColorTheme: (colorTheme: ColorTheme) => {
      localStorage.setItem(`${storageKey}-color`, colorTheme);
      setColorThemeState(colorTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
