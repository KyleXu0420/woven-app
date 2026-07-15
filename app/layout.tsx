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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
