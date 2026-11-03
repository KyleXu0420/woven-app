"use client";

import { Geist } from "next/font/google";
import { SystemState } from "@/components/system-state";
import { ThemeRestore } from "@/components/theme-restore";
import "./globals.css";

// This boundary replaces the root layout itself. It must carry its own document, stylesheet and
// sans font, and restore the same explicit stored theme rather than depending on the broken layout.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export default function GlobalError() {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeRestore />
        <SystemState variant="error" scope="public" action={{ onClick: () => window.location.reload(), label: "Try again" }} />
      </body>
    </html>
  );
}
