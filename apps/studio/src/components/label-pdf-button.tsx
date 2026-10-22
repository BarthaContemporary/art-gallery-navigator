"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button-class";
import { ChevronDownIcon } from "@/components/ui/icons";
import { menuItemClass } from "@/components/ui/menu-class";
import { cx } from "@/components/ui/cx";
import { usePanelSide } from "@/hooks/use-panel-side";

// Avery layouts the label generator supports. perPage / size shown so the user
// picks the sheet they actually have loaded; the PDF is laid out to that exact
// template (see packages/documents/src/labels.tsx).
const AVERY: { code: string; perPage: number; size: string }[] = [
  { code: "L7160", perPage: 21, size: "63.5 × 38.1 mm" },
  { code: "L7162", perPage: 16, size: "99.1 × 33.9 mm" },
  { code: "L7163", perPage: 14, size: "99.1 × 38.1 mm" },
];

/**
 * "Labels PDF ▾": asks which Avery sheet to target, then produces the PDF
 * (CLAUDE.md: label PDFs always ask for the Avery number first).
 *
 * The same disclosure as the Export and Documents menus (ExportMenu,
 * RecordMenu): a button with aria-expanded and aria-controls, a panel that
 * Escape or a click elsewhere closes with focus back on the button, kept
 * mounted while closed (hidden). The panel closes itself once the PDF has
 * downloaded; the result is reported beside the button in a live region.
 *
 * One click does both halves of what a label run needs: the file is filed on
 * the shared drive under Downloads/Docs, and the same bytes download so the
 * sheet can go straight into the printer. One request, one render.
 *
 * It has to be a fetch rather than a link: the drive copy is a write, and the
 * route requires the x-jvb-drive-save header to prove the request came from our
 * own JS; a plain navigation cannot set headers. The download is then handed
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
  variant = "secondary",
  size = "sm",
  align = "left",
}: {
  listId: string;
  /** Which label route to call: mailing labels by default, work labels for inventory lists. */
  endpoint?: string;
  buttonLabel?: string;
  filePrefix?: string;
  /** The button's look: secondary in a toolbar, quiet in a card's row of actions. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Which edge of the button the panel lines up with. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; failed: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // The preferred edge, swapped when it would put the panel off screen.
  const side = usePanelSide(open, panel, align);

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

      setNote({
        text: savedTo ? `Downloaded · saved to ${savedTo}` : "Downloaded · not filed on the drive",
        failed: false,
      });
      setOpen(false);
      button.current?.focus();
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Could not generate labels", failed: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={wrap} className="relative inline-flex flex-wrap items-center gap-y-1">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={buttonClass({ variant, size })}
      >
        {buttonLabel}
        <ChevronDownIcon size={14} />
      </button>

      <div
        ref={panel}
        id={panelId}
        hidden={!open}
        className={cx(
          "jvb-slide-enter absolute top-[calc(100%+4px)] z-40 w-64 max-w-[calc(100vw-32px)] border border-rule-strong bg-page py-1 shadow-[var(--jvb-shadow-pop)]",
          side === "right" ? "right-0" : "left-0",
        )}
      >
        <p className="label px-3 pb-1 pt-2">Choose Avery layout</p>
        {AVERY.map((a) => (
          <button
            key={a.code}
            type="button"
            disabled={busy !== null}
            aria-busy={busy === a.code || undefined}
            onClick={() => void make(a.code)}
            className={menuItemClass("disabled:cursor-default disabled:text-meta")}
          >
            <span className="block font-medium">Avery {a.code}</span>
            <span className="tabular block text-[12px] leading-[1.4] text-meta">
              {busy === a.code ? "Generating the PDF…" : `${a.perPage} per sheet · ${a.size}`}
            </span>
          </button>
        ))}
      </div>

      {/* Always mounted (empty and spaceless until there is a result), so
          the result is announced when it appears. */}
      <span
        aria-live="polite"
        className={cx("text-[12px] leading-[1.4]", note && "ml-2", note?.failed ? "text-danger" : "text-meta")}
        title={note && !note.failed ? "Labels are filed under Downloads/Docs on the shared drive" : undefined}
      >
        {note?.text ?? ""}
      </span>
    </div>
  );
}
