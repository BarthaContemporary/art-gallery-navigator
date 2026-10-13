"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/error-panel";
import { setThemeColorMeta } from "@/lib/theme";
import "./fonts.css";
import "./globals.css";

/**
 * The last-resort boundary (W16): an error in the root layout itself, where
 * the studio's own error page cannot render because the shell is what
 * failed. It replaces the whole document, so it brings its own <html>, the
 * stylesheets and the saved theme (the root layout's no-flash script is not
 * part of this document).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jvb-theme");
      const theme =
        saved === "dark" || saved === "light"
          ? saved
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
      document.documentElement.setAttribute("data-theme", theme);
      setThemeColorMeta(theme);
    } catch {
      /* storage blocked: the light theme stands */
    }
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <header className="page pt-3">
          <span className="text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent">
            Joost van den Bergh
          </span>
        </header>
        <main className="page py-6 md:py-8">
          <ErrorPanel error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
