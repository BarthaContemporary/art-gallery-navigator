"use client";

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
 * "Labels PDF" — asks which Avery sheet to target, then produces the PDF.
 *
 * One click does both halves of what a label run needs: the file is filed on
 * the shared drive under Downloads/Docs, and the same bytes download so the
 * sheet can go straight into the printer. One request, one render.
 *
 * It has to be a fetch rather than a link: the drive copy is a write, and the
 * route requires the x-jvb-drive-save header to prove the request came from our
 * own JS — a plain navigation cannot set headers. The download is then handed
 * to the browser from the response blob.
 *
 * The drive copy is best-effort server-side. If the drive is unreachable the
 * PDF still arrives and the confirmation says it was not filed, rather than
 * claiming it was.
 */
export function LabelPdfButton({
  listId,
  endpoint = "/api/export/labels.pdf",
  buttonLabel = "Labels PDF",
  filePrefix = "labels",
  className = "text-[12px] font-medium text-primary",
}: {
  listId: string;
  /** Which label route to call — mailing labels by default, work labels for inventory lists. */
  endpoint?: string;
  buttonLabel?: string;
  filePrefix?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function make(code: string) {
    setBusy(code);
    setNote(null);
    try {
      const res = await fetch(
        `${endpoint}?list=${encodeURIComponent(listId)}&template=${code}&save=1`,
        { headers: { "x-jvb-drive-save": "1" } },
      );
      if (!res.ok) {
        // 422 carries the "nobody in this list is mailable" explanation.
        throw new Error((await res.text()) || "Could not generate labels");
      }

      const savedTo = res.headers.get("X-Jvb-Drive-Saved") ?? "";
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filePrefix}-${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setNote(
        savedTo ? `Downloaded · saved to ${savedTo}` : "Downloaded · not filed on the drive",
      );
      setOpen(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not generate labels");
    } finally {
      setBusy(null);
    }
  }

  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={className}>
        {buttonLabel} ▾
      </button>

      {open ? (
        <>
          <span className="fixed inset-0 z-10" aria-hidden onClick={() => setOpen(false)} />
          <span className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-line-control bg-cell p-1 shadow-lg">
            <span className="block px-2 py-1 text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              Choose Avery layout
            </span>
            {AVERY.map((a) => (
              <button
                key={a.code}
                type="button"
                disabled={busy !== null}
                onClick={() => void make(a.code)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-body hover:bg-control disabled:opacity-50"
              >
                <span className="font-medium">
                  Avery {a.code}
                  {busy === a.code ? " — generating…" : ""}
                </span>
                <span className="block text-[11px] text-ink-soft">
                  {a.perPage} per sheet · {a.size}
                </span>
              </button>
            ))}
          </span>
        </>
      ) : null}

      {note ? (
        <span
          aria-live="polite"
          className="ml-2 text-[11px] text-ink-soft"
          title="Labels are filed under Downloads/Docs on the shared drive"
        >
          {note}
        </span>
      ) : null}
    </span>
  );
}
