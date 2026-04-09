"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("w-9 h-9", className)} />
    );
  }

  return (
    <div className={cn("flex items-center gap-1 bg-muted rounded-lg p-1", className)}>
      <button
        onClick={() => setTheme("light")}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-all",
          theme === "light"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Light mode">
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-all",
          theme === "dark"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Dark mode">
        <Moon className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={cn(
          "flex items-center justify-center w-7 h-7 rounded-md transition-all",
          theme === "system"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="System theme">
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  );
}
