"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

// Lightweight theme toggle — flips the `.dark` class on <html> + persists to localStorage.
// (No theme library; the no-flash apply happens via an inline script in app/layout.tsx.)
// The one place theme state is read and written. Both the standalone toggle and the account-menu
// row use this, so they cannot drift.
export function useTheme() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = React.useCallback(() => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
      } catch {}
      return next;
    });
  }, []);
  return { dark, toggle };
}

export function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <IconButton label="Toggle theme" onClick={toggle}>
      {dark ? <Sun /> : <Moon />}
    </IconButton>
  );
}
