import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's stock font sizes. The house adds a reading register in @theme
// (--text-read 19/30, --text-read-heading 22/28, --text-read-display 40/46); unknown to the merger, a class
// like `text-read` was filed as a text COLOUR, so cn("text-read", "text-foreground-prose") kept the colour
// and silently dropped the size — the artifact reader's body rendered at 15/22.5 instead of 19/30 while the
// public page, which does not go through cn(), rendered 19/30 (found 2026-10-02 by the line-A integration
// check). Registering the three sizes puts them in the font-size group, where they belong.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["read", "read-heading", "read-display"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
