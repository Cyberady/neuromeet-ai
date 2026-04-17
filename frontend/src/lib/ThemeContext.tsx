import type { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark" | "system";
interface ThemeContextValue { theme: Theme; resolved: "light"|"dark"; setTheme: (t: Theme) => void; }
const ThemeContext = createContext<ThemeContextValue>({ theme: "system", resolved: "light", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("nm-theme") as Theme) || "system");
  const [resolved, setResolved] = useState<"light"|"dark">("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const r = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      setResolved(r);
      document.documentElement.setAttribute("data-theme", r);
      r === "dark" ? document.documentElement.classList.add("dark") : document.documentElement.classList.remove("dark");
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  function setTheme(t: Theme) { localStorage.setItem("nm-theme", t); setThemeState(t); }

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);