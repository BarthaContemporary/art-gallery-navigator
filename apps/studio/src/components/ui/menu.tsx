"use client";

/*
 * The menu button (spec sections 4 and 5: "Export ▾", "Documents ▾",
 * "Labels ▾"). A disclosure, not an ARIA menu: a button with aria-expanded
 * and aria-controls, and a panel that may hold links, buttons and a small
 * form alike, walked with Tab.
 *
 *   <MenuButton label icon? title? align? size? collapse? defaultOpen?
 *               panelClassName?>{panel content}</MenuButton>
 *     label      the button's words, and its accessible name.
 *     icon       a leading icon from ./icons.
 *     title      a heading inside the panel, in the label style.
 *     align      which edge of the button the panel lines up with
 *                ("right", the default, for a toolbar's right end).
 *     size       the button size ("md" default, "sm").
 *     collapse   "lg" shows the icon only below lg (the label stays the
 *                accessible name); needs an icon.
 *     defaultOpen  starts open (the /ui-kit page shows it so).
 *     panelClassName  the panel's width and padding (default w-64, py-1;
 *                a panel holding a form wants "w-[340px] p-3").
 *
 *   menuItemClass(extra?)  (./menu-class, callable from server pages) the
 *     class string for a row in the panel: a link or button, 13px ink, band
 *     on hover.
 *
 * Escape or a click outside closes it and focus goes back to the button.
 * The panel stays mounted while closed (hidden), so something inside that
 * reports its own result (a drive save in progress) keeps its state, and it
 * stays open after a click inside so that result can be read.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonClass, type ButtonSize } from "./button-class";
import { cx } from "./cx";
import { ChevronDownIcon } from "./icons";

export function MenuButton({
  label,
  icon,
  title,
  align = "right",
  size = "md",
  collapse,
  defaultOpen = false,
  panelClassName = "w-64 py-1",
  children,
}: {
  label: string;
  icon?: ReactNode;
  title?: ReactNode;
  align?: "left" | "right";
  size?: ButtonSize;
  collapse?: "lg";
  defaultOpen?: boolean;
  panelClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative inline-block">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={collapse ? label : undefined}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass({ size }, collapse === "lg" ? "px-2.5 lg:px-3" : undefined)}
      >
        {icon}
        <span className={collapse === "lg" ? "hidden lg:inline" : undefined}>{label}</span>
        <ChevronDownIcon size={14} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cx(
          "absolute top-[calc(100%+4px)] z-40 max-w-[calc(100vw-32px)] border border-rule-strong bg-page shadow-[var(--jvb-shadow-pop)]",
          align === "right" ? "right-0" : "left-0",
          panelClassName,
        )}
      >
        {title ? <p className="label px-3 pb-1 pt-2">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}
