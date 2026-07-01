"use client";

import * as React from "react";
import { Sun, Moon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

// Lightweight theme toggle — flips the `.dark` class on <html> + persists to localStorage.
// (No theme library; the no-flash apply happens via an inline script in app/layout.tsx.)
export function ThemeToggle() {
  const [dark, setDark] = React.useState(false);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <IconButton label="Toggle theme" onClick={toggle}>
      {dark ? <Sun /> : <Moon />}
    </IconButton>
  );
}
