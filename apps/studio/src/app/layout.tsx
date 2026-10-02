import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

/*
 * Same two-family principle as the public site:
 *   Sans = structure (UI, headings, labels, tables) — Noto Sans.
 *   Serif = voice (catalogue prose: descriptions, condition, provenance) —
 *   Newsreader, roman only. Numerals reuse the sans with tabular figures.
 * Both are self-hosted from /public/fonts (see fonts.css). next/font/google
 * fetched them from Google at build time, and a changed Google response
 * took the production build down.
 */

export const metadata: Metadata = {
  title: {
    default: "Joost van den Bergh — Studio",
    template: "%s · Joost van den Bergh",
  },
  description: "Inventory and CRM back office",
  robots: { index: false, follow: false },
};

// Set the theme before first paint to avoid a flash. Reads the saved choice,
// falling back to the OS preference.
const themeScript = `(function(){try{var t=localStorage.getItem('jvb-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" href="/fonts/noto-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
