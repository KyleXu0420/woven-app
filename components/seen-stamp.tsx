"use client";

import * as React from "react";
import { markSeen } from "@/lib/last-seen";

// The one writer of "the viewer was last here": stamps on leaving (pagehide) and on the tab going hidden, so
// a tab left open for hours still reports the moment it was actually last looked at. Mounted once in the shell.
export function SeenStamp() {
  React.useEffect(() => {
    const stamp = () => markSeen();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stamp();
    };
    window.addEventListener("pagehide", stamp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", stamp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return null;
}
