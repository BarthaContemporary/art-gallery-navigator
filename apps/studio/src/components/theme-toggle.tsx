"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The actual theme is applied pre-paint by the inline
 * script in the root layout (no flash); this just flips data-theme and
 * persists the choice. Falls back to the OS preference until a choice is made.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("jvb-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-control bg-control text-ink-mid hover:text-ink-strong"
    >
      {/* sun / moon — swap by theme; suppressed until mounted to avoid mismatch */}
      <span aria-hidden className="text-[14px] leading-none">
        {theme === "dark" ? "☀" : theme === "light" ? "☾" : ""}
      </span>
    </button>
  );
}
