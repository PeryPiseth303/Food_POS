"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  variant?: "default" | "outline" | "ghost" | "pill";
  showLabel?: boolean;
  className?: string;
}

export default function ThemeToggle({
  variant = "default",
  showLabel = false,
  className = "",
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme, scope } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        disabled
        className={`relative inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground transition-colors ${
          variant === "pill"
            ? "px-3 py-1.5 text-xs font-semibold bg-secondary/60 border border-border"
            : variant === "outline"
            ? "border border-border bg-background/50 hover:bg-secondary"
            : "bg-secondary/70 hover:bg-secondary"
        } ${className}`}
      >
        <span className="w-4 h-4 opacity-0">⚪</span>
        {showLabel && <span className="ml-2 text-xs opacity-0">Theme</span>}
      </button>
    );
  }

  const isDark = theme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const scopeLabel =
    scope === "admin"
      ? "Admin"
      : scope === "dine_in"
      ? "Dine-In"
      : "Delivery";
  const titleText = isDark
    ? `Switch to light mode (${scopeLabel})`
    : `Switch to dark mode (${scopeLabel})`;

  const baseStyle =
    variant === "pill"
      ? "px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/80 hover:bg-secondary border border-border/80 shadow-xs"
      : variant === "outline"
      ? "p-2 rounded-xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground shadow-2xs"
      : variant === "ghost"
      ? "p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      : "p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground shadow-2xs";

  return (
    <button
      onClick={handleToggle}
      type="button"
      aria-label={titleText}
      title={titleText}
      className={`relative inline-flex items-center justify-center transition-all duration-200 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer select-none ${baseStyle} ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Moon className="w-4 h-4 text-stone-700 dark:text-stone-300 transition-transform duration-300 rotate-0 scale-100" />
        )}
      </div>

      {showLabel && (
        <span className="ml-2 text-xs font-medium select-none text-foreground">
          {isDark ? "Light" : "Dark"}
        </span>
      )}
    </button>
  );
}
