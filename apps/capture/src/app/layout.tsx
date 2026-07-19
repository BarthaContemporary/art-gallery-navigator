import type { Metadata, Viewport } from "next";
import { Newsreader, Noto_Sans } from "next/font/google";
import "./globals.css";

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
  title: { default: "JvB Capture", template: "%s · JvB Capture" },
  description: "Quick capture — works, invoices, contacts",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JvB Capture" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#faf9f5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
