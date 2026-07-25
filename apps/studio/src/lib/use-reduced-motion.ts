"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion`. The global CSS reset in globals.css already
 * neutralises CSS animations, but JS-driven motion (number tickers, path
 * drawing) has to opt out itself — this is that hook.
 *
 * Starts `false` so SSR and first paint agree, then corrects after mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
