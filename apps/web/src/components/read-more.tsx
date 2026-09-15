"use client";

import { useId, useState, type ReactNode } from "react";

/** Inline "Read more ↓" / "Read less ↑" — expands in place, never navigates. */
export function ReadMore({
  children,
  label = "Read more",
  className = "",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <div className="fold" data-open={open}>
        <div id={id} aria-hidden={!open}>
          <div className="fold-body pt-4">{children}</div>
        </div>
      </div>
      <button
        type="button"
        className="link-accent mt-3 min-h-[44px]"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Read less ↑" : `${label} ↓`}
      </button>
    </div>
  );
}
