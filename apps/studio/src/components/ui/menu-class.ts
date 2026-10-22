import { cx } from "./cx";

/**
 * A row in a MenuButton panel (./menu): a link or button at 13px in ink;
 * hovered or focused, the band with a 2px accent rule growing at its left
 * edge (.menu-row in app/globals.css). A plain function in its own module,
 * so server pages that fill a menu can call it (menu.tsx is a client module).
 */
export function menuItemClass(className?: string): string {
  return cx("menu-row block w-full px-3 py-2 text-left text-[13px] leading-[1.45] text-ink no-underline", className);
}
