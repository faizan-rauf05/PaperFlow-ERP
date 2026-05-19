"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { setThemeCookie, THEME_STORAGE_KEY } from "@/lib/theme";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  systemTheme: "light",
});

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme) {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyThemeClasses(theme, { disableTransition } = {}) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);

  const apply = () => {
    if (theme === "system") {
      root.classList.remove("dark", "light");
    } else if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  if (disableTransition) {
    const style = document.createElement("style");
    style.textContent =
      "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(style);
    apply();
    window.getComputedStyle(root);
    document.head.removeChild(style);
    return resolved;
  }

  apply();
  return resolved;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
  enableSystem = true,
  disableTransitionOnChange = false,
}) {
  const router = useRouter();
  const [theme, setThemeState] = useState(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState("light");
  const [systemTheme, setSystemTheme] = useState("light");

  useEffect(() => {
    let stored = defaultTheme;
    try {
      stored = localStorage.getItem(storageKey) || defaultTheme;
    } catch {
      /* ignore */
    }
    if (!enableSystem && stored === "system") {
      stored = "light";
    }
    setThemeState(stored);
    setThemeCookie(stored);
    const resolved = applyThemeClasses(stored, {
      disableTransition: disableTransitionOnChange,
    });
    setResolvedTheme(resolved);
    setSystemTheme(getSystemTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const next = getSystemTheme();
      setSystemTheme(next);
      setThemeState((current) => {
        if (current === "system") {
          const r = applyThemeClasses("system", {
            disableTransition: disableTransitionOnChange,
          });
          setResolvedTheme(r);
        }
        return current;
      });
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [defaultTheme, storageKey, enableSystem, disableTransitionOnChange]);

  const setTheme = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(theme) : next;
      const final = !enableSystem && value === "system" ? "light" : value;
      setThemeState(final);
      try {
        localStorage.setItem(storageKey, final);
      } catch {
        /* ignore */
      }
      setThemeCookie(final);
      const resolved = applyThemeClasses(final, {
        disableTransition: disableTransitionOnChange,
      });
      setResolvedTheme(resolved);
      router.refresh();
    },
    [theme, storageKey, enableSystem, disableTransitionOnChange, router],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
    }),
    [theme, setTheme, resolvedTheme, systemTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
