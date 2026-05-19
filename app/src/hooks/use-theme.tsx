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

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  const [themeState, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [colorThemeState, setColorThemeState] = useState<ColorTheme>(
    () => (localStorage.getItem(`${storageKey}-color`) as ColorTheme) || "emerald"
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
