"use client";

import { SaveToDriveLink } from "@/components/save-to-drive";

import { useState } from "react";

// Avery layouts the label generator supports. perPage / size shown so the user
// picks the sheet they actually have loaded; the PDF is laid out to that exact
// template (see packages/documents/src/labels.tsx).
const AVERY: { code: string; perPage: number; size: string }[] = [
  { code: "L7160", perPage: 21, size: "63.5 × 38.1 mm" },
  { code: "L7162", perPage: 16, size: "99.1 × 33.9 mm" },
  { code: "L7163", perPage: 14, size: "99.1 × 38.1 mm" },
];

/**
 * "Labels PDF" control that asks which Avery sheet to target before generating,
 * then downloads the PDF laid out to that template.
 */
export function LabelPdfButton({
  listId,
  className = "text-[12px] font-medium text-primary",
}: {
  listId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className}>
        Labels PDF ▾
      </button>
      {open ? (
        <>
          <span className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <span className="absolute left-0 z-20 mt-1 w-60 rounded-lg border border-line-control bg-cell p-1 shadow-lg">
            <span className="block px-2 py-1 text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              Choose Avery layout
            </span>
            {AVERY.map((a) => (
              <SaveToDriveLink
                key={a.code}
                href={`/api/export/labels.pdf?list=${encodeURIComponent(listId)}&template=${a.code}`}
                className="block rounded-md px-2 py-1.5 text-[12.5px] text-ink-body hover:bg-control"
              >
                <span className="font-medium">Avery {a.code}</span>
                <span className="block text-[11px] text-ink-soft">
                  {a.perPage} per sheet · {a.size}
                </span>
              </SaveToDriveLink>
            ))}
          </span>
        </>
      ) : null}
    </span>
  );
}
