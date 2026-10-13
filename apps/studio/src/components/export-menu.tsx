"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SaveToDriveLink } from "@/components/save-to-drive";
import { buttonClass, type ButtonSize } from "@/components/ui/button-class";
import { ChevronDownIcon, DownloadIcon } from "@/components/ui/icons";

export type ExportItem = { href: string; label: string };

/**
 * "Export ▾": a view's export formats behind one button, so a toolbar carries
 * one control rather than one per format.
 *
 * A disclosure (a button with aria-expanded and a group of links), not an
 * ARIA menu: Tab walks the links, Escape or a click elsewhere closes it and
 * focus goes back to the button.
 *
 * Each format is a SaveToDriveLink, as the separate buttons were, so it still
 * files the document on the shared drive and its own label reports the
 * result. The panel therefore stays open after a click, until it is
 * dismissed, so that report can be read.
 */
export function ExportMenu({
  items,
  count,
  noun = "records",
  size = "md",
  align = "right",
}: {
  items: ExportItem[];
  /** How many rows the export holds; shown on the button and read out with it. */
  count?: number;
  /** What the count counts, for the accessible name ("Export 108 records"). */
  noun?: string;
  size?: ButtonSize;
  /** Which edge of the button the panel lines up with. */
  align?: "left" | "right";
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

  const counted = count !== undefined ? `${count.toLocaleString("en-GB")}` : null;

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={counted ? `Export ${counted} ${noun}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass({ size })}
      >
        <DownloadIcon size={14} />
        Export
        {counted ? <span className="tabular text-meta">{counted}</span> : null}
        <ChevronDownIcon size={14} />
      </button>
      {open ? (
        <div
          id={panelId}
          className={`absolute z-30 mt-1 w-56 border border-rule-strong bg-page py-1 shadow-[var(--jvb-shadow-pop)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <SaveToDriveLink
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-[13px] leading-[1.45] text-ink hover:bg-band"
            >
              {item.label}
            </SaveToDriveLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
