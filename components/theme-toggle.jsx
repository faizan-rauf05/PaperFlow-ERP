"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, variant = "outline", size = "icon" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn("size-9 shrink-0", className)}
        aria-hidden
        disabled
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("theme-toggle-btn size-9 shrink-0", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
