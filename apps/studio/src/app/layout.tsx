import type { Metadata } from "next";
import { Newsreader, Noto_Sans } from "next/font/google";
import "./globals.css";
import { Plausible } from "@/components/plausible";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Plausible />
      </body>
    </html>
  );
}
