"use client";

import { useEffect, useState } from "react";
import { setThemeColorMeta } from "@/lib/theme";
import { buttonClass } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

/**
 * Light/dark toggle. The actual theme is applied pre-paint by the inline
 * script in the root layout (no flash); this just flips data-theme, moves the
 * theme-color meta with it and persists the choice. Falls back to the OS
 * preference until a choice is made.
 *
 * Icon-only in the desktop header; `withLabel` adds the words, for the phone
 * menu's footer where there is room and no tooltip.
 */
export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") ?? "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setThemeColorMeta(next);
    try {
      localStorage.setItem("jvb-theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  // The icon shows the theme a press switches to; nothing until mounted, so
  // the server render and the first client render agree.
  const icon = theme === "dark" ? <SunIcon size={16} /> : theme === "light" ? <MoonIcon size={16} /> : null;

  if (withLabel) {
    return (
      <button type="button" onClick={toggle} className={buttonClass({})}>
        {icon}
        {theme === "dark" ? "Light theme" : "Dark theme"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className={buttonClass({ variant: "quiet", size: "sm", iconOnly: true })}
    >
      {icon}
    </button>
  );
}
