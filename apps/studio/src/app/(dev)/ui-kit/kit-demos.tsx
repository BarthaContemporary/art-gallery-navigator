"use client";

/*
 * The /ui-kit page's live pieces: the parts that need state or a handler
 * (which a server page cannot pass), so they can be tried by hand as well as
 * screenshotted. Dev only, like the page.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
                  className="relative"
                  numeric={c.key === "price"}
                  sort={stateOf(c.key)}
                  onSort={() =>
                    setSort((s) => (s?.key === c.key && s.dir === "asc" ? { key: c.key, dir: "desc" } : { key: c.key, dir: "asc" }))
                  }
                >
                  {c.label}
                  <ColumnResizer {...cols.handleProps(c.key, c.label)} />
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
