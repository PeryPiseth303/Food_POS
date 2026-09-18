"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";

export type Theme = "light" | "dark";
export type ThemeScope = "admin" | "dine_in" | "delivery";

export const ADMIN_THEME_KEY = "admin_theme";
export const DINEIN_THEME_KEY = "dinein_theme";
export const DELIVERY_THEME_KEY = "delivery_theme";

export const SCOPE_KEYS: Record<ThemeScope, string> = {
  admin: ADMIN_THEME_KEY,
  dine_in: DINEIN_THEME_KEY,
  delivery: DELIVERY_THEME_KEY,
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme | string) => void;
  resolvedTheme: Theme;
  isDark: boolean;
  scope: ThemeScope;
  setScope: (scope: ThemeScope) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }
}

function detectScopeFromLocation(pathname: string): ThemeScope {
  if (pathname.startsWith("/admin")) {
    return "admin";
  }
  if (typeof window !== "undefined") {
    const search = window.location.search || "";
    if (search.includes("table=")) {
      return "dine_in";
    }
  }
  return "delivery";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [scope, setScopeState] = useState<ThemeScope>(() => detectScopeFromLocation(pathname || ""));
  const [adminTheme, setAdminTheme] = useState<Theme>("light");
  const [dineinTheme, setDineinTheme] = useState<Theme>("light");
  const [deliveryTheme, setDeliveryTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Initialize all themes from their separate localStorage keys
  useEffect(() => {
    try {
      const savedAdmin = (localStorage.getItem(ADMIN_THEME_KEY) as Theme) || "light";
      const savedDinein = (localStorage.getItem(DINEIN_THEME_KEY) as Theme) || "light";
      const savedDelivery = (localStorage.getItem(DELIVERY_THEME_KEY) as Theme) || "light";

      const validAdmin = savedAdmin === "dark" ? "dark" : "light";
      const validDinein = savedDinein === "dark" ? "dark" : "light";
      const validDelivery = savedDelivery === "dark" ? "dark" : "light";

      setAdminTheme(validAdmin);
      setDineinTheme(validDinein);
      setDeliveryTheme(validDelivery);

      const initialScope = detectScopeFromLocation(window.location.pathname || pathname || "");
      setScopeState(initialScope);

      const currentTheme =
        initialScope === "admin"
          ? validAdmin
          : initialScope === "dine_in"
          ? validDinein
          : validDelivery;

      applyThemeToDocument(currentTheme);
    } catch {
      applyThemeToDocument("light");
    }
    setMounted(true);
  }, []);

  // Update scope when pathname changes
  useEffect(() => {
    if (!mounted) return;
    const newScope = detectScopeFromLocation(pathname || "");
    setScopeState(newScope);

    const targetKey = SCOPE_KEYS[newScope];
    const saved = (localStorage.getItem(targetKey) as Theme) || "light";
    const validTheme: Theme = saved === "dark" ? "dark" : "light";
    applyThemeToDocument(validTheme);
  }, [pathname, mounted]);

  // Method for page components to explicitly bind their scope (e.g. MenuContent when tableParam is present)
  const setScope = useCallback((newScope: ThemeScope) => {
    setScopeState(newScope);
    try {
      const targetKey = SCOPE_KEYS[newScope];
      const saved = (localStorage.getItem(targetKey) as Theme) || "light";
      const validTheme: Theme = saved === "dark" ? "dark" : "light";
      applyThemeToDocument(validTheme);
    } catch {
      applyThemeToDocument("light");
    }
  }, []);

  // Listen to cross-tab storage changes ONLY for the currently active scope
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const expectedKey = SCOPE_KEYS[scope];
      if (e.key === expectedKey && e.newValue) {
        const next: Theme = e.newValue === "dark" ? "dark" : "light";
        if (scope === "admin") setAdminTheme(next);
        else if (scope === "dine_in") setDineinTheme(next);
        else setDeliveryTheme(next);
        applyThemeToDocument(next);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [scope]);

  // Determine active theme based on current scope
  const activeTheme: Theme = useMemo(() => {
    if (scope === "admin") return adminTheme;
    if (scope === "dine_in") return dineinTheme;
    return deliveryTheme;
  }, [scope, adminTheme, dineinTheme, deliveryTheme]);

  // Toggle or set theme ONLY for current active scope
  const handleSetTheme = useCallback((newThemeInput: Theme | string) => {
    const nextTheme: Theme = newThemeInput === "dark" ? "dark" : "light";
    const currentKey = SCOPE_KEYS[scope];

    try {
      localStorage.setItem(currentKey, nextTheme);
    } catch {}

    if (scope === "admin") {
      setAdminTheme(nextTheme);
    } else if (scope === "dine_in") {
      setDineinTheme(nextTheme);
    } else {
      setDeliveryTheme(nextTheme);
    }

    applyThemeToDocument(nextTheme);
  }, [scope]);

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      theme: activeTheme,
      setTheme: handleSetTheme,
      resolvedTheme: activeTheme,
      isDark: activeTheme === "dark",
      scope,
      setScope,
    }),
    [activeTheme, handleSetTheme, scope, setScope]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: "light" as Theme,
      setTheme: () => {},
      resolvedTheme: "light" as Theme,
      isDark: false,
      scope: "delivery" as ThemeScope,
      setScope: () => {},
    };
  }
  return context;
}
