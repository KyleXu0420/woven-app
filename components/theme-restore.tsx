"use client";

import { useLayoutEffect } from "react";

// The blocking head script handles the first paint. A server notFound/error can make React
// rebuild the document during hydration, replacing the <html> class after that script ran.
// Restore the same explicit preference before the replacement paints; an unset value stays light.
export function ThemeRestore() {
  useLayoutEffect(() => {
    try {
      document.documentElement.classList.toggle("dark", localStorage.getItem("theme") === "dark");
    } catch {}
  }, []);

  return null;
}
