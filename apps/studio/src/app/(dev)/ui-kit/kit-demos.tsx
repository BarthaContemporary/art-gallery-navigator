"use client";

/*
 * The /ui-kit page's live pieces: the parts that need state or a handler
 * (which a server page cannot pass), so they can be tried by hand as well as
 * screenshotted. Dev only, like the page.
 */
import { useEffect, useRef, useState } from "react";
import { DeleteListButton } from "@/components/delete-list-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ToggleChip } from "@/components/ui/chips";
import { SaveStatus, SaveStatusProvider, useSaveReporter, type SaveState } from "@/components/ui/save-status";
import { ColumnResizer, EmptyRow, Table, TableFrame, Td, Th, Tr, type SortState } from "@/components/ui/table";
import { WebsiteSwitch } from "@/components/ui/website-switch";
import { StatusBadge } from "@/components/ui/badge";
import { useResizableColumns } from "@/hooks/use-resizable-columns";

const noop = () => {};

/** Every SaveStatus state, side by side, not sticky. */
export function SaveStatusStates() {
  return (
    <div className="space-y-1">
      <SaveStatus sticky={false} state="idle" />
      <SaveStatus sticky={false} state="saving" />
      <SaveStatus sticky={false} state="saved" />
      <SaveStatus sticky={false} state="error" what="the consignment" onRetry={noop} />
      <SaveStatus sticky={false} state="error" signedOut onRetry={noop} />
      <SaveStatus
        sticky={false}
        state="error"
        what="the consignment"
        detail="The share must be more than 0 and less than 100."
      />
      <SaveStatus sticky={false} state="saved">
        <Button variant="primary">Done</Button>
      </SaveStatus>
    </div>
  );
}

function Source({ id }: { id: string }) {
  const report = useSaveReporter(id);
  const set = (state: SaveState) =>
    report(state === "error" ? { state, what: `the ${id}`, onRetry: () => report({ state: "saved" }) } : { state });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 text-[12px] text-meta">{id}</span>
      <Button size="sm" onClick={() => set("saving")}>Saving</Button>
      <Button size="sm" onClick={() => set("saved")}>Saved</Button>
      <Button size="sm" onClick={() => set("error")}>Fail</Button>
    </div>
  );
}

/** Two sources reporting into one line: an error anywhere wins. */
export function SaveStatusLive() {
  return (
    <SaveStatusProvider>
      <SaveStatus sticky={false} />
      <div className="mt-2 space-y-2">
        <Source id="record" />
        <Source id="consignment" />
      </div>
    </SaveStatusProvider>
  );
}

export function ToggleChips() {
  const [on, setOn] = useState<Record<string, boolean>>({ flagged: true, framed: false, catalogued: false });
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(on).map(([key, pressed]) => (
        <ToggleChip key={key} pressed={pressed} onClick={() => setOn((s) => ({ ...s, [key]: !s[key] }))}>
          {key.charAt(0).toUpperCase() + key.slice(1)}
        </ToggleChip>
      ))}
    </div>
  );
}

export function LiveWebsiteSwitch() {
  const [on, setOn] = useState(false);
  return <WebsiteSwitch on={on} onClick={() => setOn((v) => !v)} />;
}

const COLUMNS = [
  { key: "stock", label: "Stock", width: 120 },
  { key: "title", label: "Title", width: 240 },
  { key: "status", label: "Status", width: 140 },
  { key: "price", label: "Price £", width: 100 },
];
const ROWS = [
  { stock: "2026-0014", title: "Untitled", status: "in_stock", price: 4200 },
  { stock: "2025-0009", title: "Low tray basket, plaited susudake", status: "reserved", price: 12000 },
  { stock: "2024-0002", title: "Inlaid wooden box, 1972", status: "sold", price: 860 },
];

/** Resizable columns (drag, or Tab to a handle and press ← →) and client-side sorting. */
export function ResizableSortableTable() {
  const cols = useResizableColumns(COLUMNS, { storageKey: "jvb:ui-kit:colwidths:v1" });
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const rows = sort
    ? [...ROWS].sort((a, b) => {
        const av = a[sort.key as keyof typeof a];
        const bv = b[sort.key as keyof typeof b];
        const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === "asc" ? c : -c;
      })
    : ROWS;
  const stateOf = (key: string): SortState => (sort?.key === key ? sort.dir : "none");
  return (
    <div>
      <div className="mb-1.5 flex justify-end">
        {cols.isCustomised ? (
          <Button variant="quiet" size="sm" onClick={cols.resetAll}>
            Reset column widths
          </Button>
        ) : (
          <span className="h-[var(--jvb-control-h-sm)]" />
        )}
      </div>
      <TableFrame>
        <Table ref={cols.tableRef} style={{ width: cols.totalWidth(), tableLayout: "fixed" }} className="min-w-full">
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} ref={cols.colRef(c.key)} style={{ width: cols.widthOf(c.key) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <Th
                  key={c.key}
                  numeric={c.key === "price"}
                  sort={stateOf(c.key)}
                  onSort={() =>
                    setSort((s) => (s?.key === c.key && s.dir === "asc" ? { key: c.key, dir: "desc" } : { key: c.key, dir: "asc" }))
                  }
                  // Beside the sort button, not inside it: a drag never sorts.
                  after={<ColumnResizer {...cols.handleProps(c.key, c.label)} />}
                >
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.stock}>
                <Td className="tabular truncate text-ink">{r.stock}</Td>
                <Td className="truncate text-body">{r.title}</Td>
                <Td>
                  <StatusBadge status={r.status} variant="dot" />
                </Td>
                <Td numeric>{r.price.toLocaleString("en-GB")}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableFrame>
    </div>
  );
}

/** An empty table with its one next action. */
export function EmptyTable() {
  return (
    <TableFrame>
      <Table>
        <thead>
          <tr>
            <Th>Stock</Th>
            <Th>Title</Th>
            <Th numeric>Price £</Th>
          </tr>
        </thead>
        <tbody>
          <EmptyRow colSpan={3} action={<Button size="sm" onClick={noop}>Clear filters</Button>}>
            No works match these filters.
          </EmptyRow>
        </tbody>
      </Table>
    </TableFrame>
  );
}

/** A notice the reader can close (Notice onDismiss); Restore brings it back. */
export function DismissibleNotice() {
  const [shown, setShown] = useState(true);
  return shown ? (
    <Notice tone="ok" onDismiss={() => setShown(false)}>
      Added 3 works to &ldquo;Autumn fair&rdquo;.
    </Notice>
  ) : (
    <Button size="sm" variant="quiet" onClick={() => setShown(true)}>
      Restore the notice
    </Button>
  );
}

/** The shared delete with its inline confirm step, live (the action does nothing here). */
export function LiveDeleteListButton() {
  return <DeleteListButton action={noop} id="ui-kit" name="Autumn fair" />;
}

const TONE_ROWS = [
  ["ok", "Saved", "saved or done"],
  ["warn", "Overdue", "flagged, needs attention"],
  ["danger", "Couldn’t save", "errors, destructive actions"],
  ["info", "Draft", "a neutral notice"],
] as const;

/** One CSS colour as sRGB bytes, through a 1x1 canvas (reads hex, rgb(), color-mix() alike). */
function rgbOf(css: string): [number, number, number] | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The four state tones on their washes, with the contrast measured from the
 * colours the page actually draws (so the figures follow the theme).
 */
export function ToneSwatches() {
  const root = useRef<HTMLDivElement>(null);
  const [ratios, setRatios] = useState<Record<string, string>>({});
  useEffect(() => {
    const measure = () => {
      const out: Record<string, string> = {};
      root.current?.querySelectorAll<HTMLElement>("[data-swatch]").forEach((el) => {
        const cs = getComputedStyle(el);
        const fg = rgbOf(cs.color);
        const bg = rgbOf(cs.backgroundColor);
        const page = rgbOf(getComputedStyle(document.documentElement).getPropertyValue("--jvb-page").trim());
        if (!fg || !bg || !page) return;
        out[el.dataset.swatch!] = `${contrast(fg, bg).toFixed(2)}:1 on its wash · ${contrast(fg, page).toFixed(2)}:1 on the page`;
      });
      setRatios(out);
    };
    measure();
    // The theme switch flips data-theme on <html>; measure again once its
    // colour transition (200ms) has finished.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const mo = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 260);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      mo.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return (
    <div ref={root} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TONE_ROWS.map(([tone, word, use]) => (
        <div key={tone} className="min-w-0">
          <div
            data-swatch={tone}
            className="flex h-14 items-center border-l-[3px] px-3 text-[13px] font-medium"
            style={{
              color: `var(--jvb-${tone})`,
              background: `var(--jvb-${tone}-wash)`,
              borderColor: `var(--jvb-${tone})`,
            }}
          >
            {word}
          </div>
          <p className="mt-1 text-[12px] leading-[1.4] text-body">
            {tone} / {tone}-wash: {use}
          </p>
          <p className="tabular text-[12px] leading-[1.4] text-meta">{ratios[tone] ?? "measuring…"}</p>
        </div>
      ))}
    </div>
  );
}
