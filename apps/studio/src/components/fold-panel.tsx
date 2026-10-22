"use client";

import { useId, useState, type ReactNode } from "react";
import { Collapse } from "@/components/ui/collapse";
import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * A collapsible section for the Inventory Lists & Docs hub. Each panel opens
 * independently, revealing its content inline instead of navigating away.
 * Drawn as a Section (a rule-strong top edge and a heading, no box) whose
 * heading is the toggle. The body folds open on its grid row (Collapse), the
 * chevron turns a quarter, and the heading's words take the ink on hover.
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
  const bodyId = useId();
  return (
    <section className="border-t border-rule-strong">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group flex w-full items-center justify-between gap-3 py-3 text-left"
        >
          <span className="flex items-baseline gap-2">
            <span className="text-[14.5px] font-semibold leading-[1.45] text-ink">{title}</span>
            {count != null ? <span className="tabular text-[12px] leading-[1.4] text-meta">{count}</span> : null}
          </span>
          <ChevronRightIcon
            size={16}
            className={`shrink-0 text-meta transition-[transform,color] duration-[220ms] ease-[var(--jvb-ease-out)] group-hover:text-ink ${
              open ? "rotate-90" : "group-hover:translate-x-0.5"
            }`}
          />
        </button>
      </h2>
      <Collapse id={bodyId} open={open}>
        <div className="pb-5">
          {action ? <div className="mb-3 flex flex-wrap items-center gap-2">{action}</div> : null}
          {children}
        </div>
      </Collapse>
    </section>
  );
}
