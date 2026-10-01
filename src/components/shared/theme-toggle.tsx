"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

/**
 * Light / dark theme toggle.
 * - Icons are swapped with pure CSS (dark:hidden / dark:block): the .dark
 *   class is on <html> before paint, so the icon is always correct with no
 *   hydration mismatch.
 * - The click reads the authoritative DOM state (html.dark) at event time,
 *   so it flips the right way even if the React context is briefly stale
 *   right after a hard navigation.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  function onToggle() {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Toggle light/dark theme"
      title="Toggle light/dark theme"
      onClick={onToggle}
    >
      <Sun className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </Button>
  );
}
