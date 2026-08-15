import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// All-sans (LOCKED 2026-07-11): Geist carries UI + display + reading; Geist Mono is the agent's / code voice.
// The retired editorial serif (Fraunces) is intentionally gone — `--font-serif` resolves to Geist in globals.css.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Woven — the home for AI artifacts",
  description: "Knowledge, woven. Drop an artifact; the agent weaves it into your team's graph.",
};

// The no-flash theme apply. Runs BLOCKING in <head>, before first paint, so a stored dark
// preference survives a reload / server navigation instead of flashing light and reverting.
// Reads only what components/theme-toggle.tsx writes (localStorage.theme = "dark" | "light");
// deliberately does NOT consult prefers-color-scheme, so an unset preference stays light —
// honouring the system is a separate product decision, not a bootstrap concern.
// `suppressHydrationWarning` on <html> below is what lets this mutate the class pre-hydration.
const NO_FLASH_THEME = `try{if(localStorage.theme==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
