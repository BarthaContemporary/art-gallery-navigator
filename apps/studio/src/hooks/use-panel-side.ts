"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Which edge of its button a menu panel lines up with, kept on screen.
 *
 * The caller names the preferred edge ("right" for a toolbar's right end).
 * When the panel opens, it is measured before it paints: if that edge would
 * push it past the viewport (a header's actions wrap under the title on a
 * phone, so a right-aligned panel runs off the left), the other edge is used
 * instead. Closed, it goes back to the preferred edge.
 */
export function usePanelSide(
  open: boolean,
  panel: RefObject<HTMLElement | null>,
  preferred: "left" | "right",
): "left" | "right" {
  const [side, setSide] = useState(preferred);

  useLayoutEffect(() => {
    if (!open) {
      setSide(preferred);
      return;
    }
    const el = panel.current;
    if (!el) return;
    const gutter = 8;
    const r = el.getBoundingClientRect();
    if (r.left < gutter && side === "right") setSide("left");
    else if (r.right > window.innerWidth - gutter && side === "left") setSide("right");
    // side is read, not watched: one flip per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferred, panel]);

  return side;
}
