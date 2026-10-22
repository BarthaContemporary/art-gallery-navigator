"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * A menu button on the record header ("Documents & lists"): the fact sheet
 * and certificate exports and the add-to-list form behind one button, so the
 * artwork leads the page rather than a row of export links.
 *
 * A disclosure (a button with aria-expanded and a panel), not an ARIA menu:
 * the panel holds a form as well as links, and Tab walks both. Escape or a
 * click elsewhere closes it and focus goes back to the button. The panel
 * stays open after a click inside, because the drive-save links report their
 * result in their own label.
 *
 * The children are rendered by the server page, so the server-action form
 * inside posts exactly what it did when it sat in the old disclosure.
 */
export function RecordMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
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
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass({}, "px-2.5 lg:px-3")}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
        <ChevronDownIcon size={14} />
      </button>
      {/* Kept mounted while closed so a drive save in progress keeps its
          state; hidden removes it from the tab order and the page. */}
      <div
        id={panelId}
        hidden={!open}
        className="jvb-slide-enter absolute right-0 top-[calc(100%+4px)] z-40 w-[min(340px,calc(100vw-32px))] border border-rule-strong bg-page p-3"
        style={{ boxShadow: "var(--jvb-shadow-pop)" }}
      >
        {children}
      </div>
    </div>
  );
}
