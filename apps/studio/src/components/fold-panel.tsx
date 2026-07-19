"use client";

import { useState, type ReactNode } from "react";

/**
 * A collapsible section for the Inventory Lists & Docs hub. Each panel opens
 * independently, revealing its content inline instead of navigating away.
 */
export function FoldPanel({
  title,
  count,
  action,
  children,
  defaultOpen = false,
}: {
  title: string;
  count?: number | null;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[11px] border border-line bg-cell">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-control/40"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-ink-strong">{title}</span>
          {count != null ? <span className="font-mono text-[12px] text-ink-soft">{count}</span> : null}
        </span>
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 16 16"
          className={`shrink-0 text-ink-soft transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="border-t border-line-soft px-5 py-4">
          {action ? <div className="mb-3 flex flex-wrap items-center gap-2">{action}</div> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
