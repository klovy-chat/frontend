import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export const THEMES = ["dark", "light", "black", "blue", "forest", "desert"] as const;

export type Theme = (typeof THEMES)[number];

interface ThemeContextValue {
  theme: Theme;
  messageTextSize: "s" | "m" | "l";
  setMessageTextSize: (size: "s" | "m" | "l") => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
  return (
    value !== null &&
    THEMES.includes(value as Theme)
  );
}

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const savedTheme =
    window.localStorage.getItem("klovy-theme");

  if (savedTheme === "mint") return "forest";

  return isTheme(savedTheme)
    ? savedTheme
    : "dark";
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [messageTextSize, setMessageTextSize] = useState<"s" | "m" | "l">(() => {
    const saved = window.localStorage.getItem("klovy-message-text-size");
    return saved === "s" || saved === "l" ? saved : "m";
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--message-text-size", { s: "12px", m: "14px", l: "16px" }[messageTextSize]);
    window.localStorage.setItem("klovy-message-text-size", messageTextSize);
  }, [messageTextSize]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("klovy-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) =>
      current === "light" ? "dark" : "light",
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        messageTextSize,
        setMessageTextSize,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider",
    );
  }

  return context;
}