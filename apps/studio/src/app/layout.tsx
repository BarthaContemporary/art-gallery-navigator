import type { Metadata } from "next";
import { Newsreader, Noto_Sans } from "next/font/google";
import "./globals.css";

/*
 * Same two-family principle as the public site:
 *   Sans = structure (UI, headings, labels, tables) — Noto Sans.
 *   Serif = voice (catalogue prose: descriptions, condition, provenance) —
 *   Newsreader, roman only. Numerals reuse the sans with tabular figures.
 */
const sans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--jvb-font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal"],
  variable: "--jvb-font-serif",
  display: "swap",
});

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
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
