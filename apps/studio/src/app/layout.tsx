import type { Metadata } from "next";
import { THEME_COLOR } from "@/lib/theme";
import "./fonts.css";
import "./globals.css";

/*
 * One family, as on the public site: Noto Sans for everything, with the
 * platform's Japanese face for makers' native names and tabular figures for
 * numerals (the stack is --jvb-font-sans in packages/ui/src/tokens.css).
 * Newsreader remains only behind .font-serif in two places (the AI draft
 * preview and the newsletter designer's text) until the owner decides on
 * dropping it (docs/studio/owner-decisions-2026-10.md, item 23).
 * The faces are self-hosted from /public/fonts (see fonts.css): next/font/google
 * fetched them from Google at build time, and a changed Google response
 * took the production build down.
 */

export const metadata: Metadata = {
  title: {
    default: "Studio · Joost van den Bergh",
    template: "%s · Joost van den Bergh",
  },
  description: "Inventory and CRM back office",
  robots: { index: false, follow: false },
};

// Set the theme before first paint to avoid a flash. Reads the saved choice,
// falling back to the OS preference. It also writes <meta name="theme-color">
// (the page ground, so the phone's status bar and the installed app's title
// bar match the theme). The tag is created here rather than rendered by React,
// because React may place its own head tags after this script, and React 19
// leaves tags it did not render alone when hydrating <head>. ThemeToggle keeps
// it in step afterwards (lib/theme.ts).
const themeScript = `(function(){try{var t=localStorage.getItem('jvb-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var m=document.createElement('meta');m.name='theme-color';m.content=t==='dark'?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)};document.head.appendChild(m);}catch(e){}})();`;

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
