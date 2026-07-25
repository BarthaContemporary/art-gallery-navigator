"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ←/→ move between records on the piece-detail page (skipped while typing in a
 * field, so it never fights form entry). Renders nothing.
 */
export function RecordKeyNav({
  prevHref,
  nextHref,
}: {
  prevHref?: string | null;
  nextHref?: string | null;
}) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.key === "ArrowLeft" && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if (e.key === "ArrowRight" && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, router]);
  return null;
}
