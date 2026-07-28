"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill, STATUS_LABELS } from "@/components/status-pill";
import { RegisterBadge } from "@/components/register-badge";

export type InventoryRow = {
  id: string;
  stock_number: string;
  legacy_stock_number: string | null;
  title: string | null;
  needs_completion?: boolean;
  maker_name: string | null;
  maker_dates: string | null;
  category_name: string | null;
  location_name: string | null;
  status: string;
  ledger?: "jvb" | "external";
};

type Col = {
  key: string;
  label: string;
  sortable: boolean;
  resizable: boolean;
  width: number; // default width (px)
  align?: "left" | "right";
};

// The image column is fixed; every other column is drag-resizable. Sort keys
// match the SORTABLE map in the inventory page so header clicks re-sort server-side.
const COLS: Col[] = [
  { key: "select", label: "", sortable: false, resizable: false, width: 40 },
  { key: "image", label: "", sortable: false, resizable: false, width: 56 },
  { key: "stock_number", label: "Stock", sortable: true, resizable: true, width: 130 },
  { key: "title", label: "Title", sortable: true, resizable: true, width: 300 },
  { key: "maker_name", label: "Maker", sortable: true, resizable: true, width: 170 },
  { key: "category_name", label: "Category", sortable: true, resizable: true, width: 150 },
  { key: "location_code", label: "Location", sortable: true, resizable: true, width: 120 },
  { key: "status", label: "Status", sortable: true, resizable: true, width: 130 },
];

const MIN_W = 64;
const STORAGE_KEY = "jvb:inventory:colwidths:v2";
const DENSITY_KEY = "jvb:inventory:density:v1";
const DEFAULTS: Record<string, number> = Object.fromEntries(
  COLS.map((c) => [c.key, c.width]),
);

export function InventoryTable({
  rows,
  thumbs,
  lists = [],
  locations = [],
}: {
  rows: InventoryRow[];
  thumbs: Record<string, string>;
  lists?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeSort = params.get("sort");
  const activeDir = (params.get("dir") ?? "asc") as "asc" | "desc";

  // ---- multi-select (add to list / bulk edit) ----
  // Persisted to sessionStorage so a selection survives paging and sorting
  // within the tab — you can gather works across several pages before acting.
  // v2 stores { ids, startedAt } rather than a bare array. The selection has no
  // expiry — gathering works across several pages is the point of persisting it
  // — but a selection you left behind an hour ago and have forgotten is a real
  // hazard next to a bulk status change, so the bar says how old it is.
  const SEL_KEY = "jvb:inventory:selected:v2";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** When the current selection began; null whenever nothing is selected. */
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SEL_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { ids?: unknown; startedAt?: unknown };
      const ids = Array.isArray(parsed?.ids)
        ? parsed.ids.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length === 0) return;
      setSelected(new Set(ids));
      setStartedAt(typeof parsed?.startedAt === "number" ? parsed.startedAt : Date.now());
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  useEffect(() => {
    try {
      if (selected.size === 0) {
        sessionStorage.removeItem(SEL_KEY);
        return;
      }
      // Stamp on the first pick; adding more later doesn't reset the clock,
      // since the question is "how long ago did I start this?".
      const started = startedAt ?? Date.now();
      if (startedAt === null) setStartedAt(started);
      sessionStorage.setItem(SEL_KEY, JSON.stringify({ ids: [...selected], startedAt: started }));
    } catch {
      /* ignore */
    }
  }, [selected, startedAt]);

  // Clear the stamp when the selection empties, so the next one starts fresh.
  useEffect(() => {
    if (selected.size === 0 && startedAt !== null) setStartedAt(null);
  }, [selected, startedAt]);
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }

  const [widths, setWidths] = useState<Record<string, number>>(DEFAULTS);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const tableRef = useRef<HTMLTableElement | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Load persisted widths + density after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved && typeof saved === "object") {
        setWidths((w) => ({ ...w, ...saved }));
      }
    } catch {
      /* ignore malformed storage */
    }
    if (localStorage.getItem(DENSITY_KEY) === "compact") setDensity("compact");
  }, []);

  function toggleDensity() {
    setDensity((d) => {
      const next = d === "compact" ? "comfortable" : "compact";
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const rowPad = density === "compact" ? "py-1.5" : "py-2.5";

  const totalWidth = () =>
    COLS.reduce((s, c) => s + (c.resizable ? widths[c.key] ?? c.width : c.width), 0);

  function sort(column: string, dir: "asc" | "desc") {
    const p = new URLSearchParams(params.toString());
    p.set("sort", column);
    p.set("dir", dir);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }
  // Click toggles: first click sorts ascending, clicking the active column
  // again flips to descending (and back).
  function onHeaderClick(column: string) {
    const nextDir = activeSort === column && activeDir === "asc" ? "desc" : "asc";
    sort(column, nextDir);
  }

  // ---- resize (mutate the <col>/<table> directly during drag; commit on release) ----
  function onResizeMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const next = Math.max(MIN_W, d.startW + (e.clientX - d.startX));
    const col = colRefs.current[d.key];
    if (col) col.style.width = `${next}px`;
    if (tableRef.current) {
      const others = COLS.reduce(
        (s, c) => s + (c.key === d.key ? 0 : c.resizable ? widths[c.key] ?? c.width : c.width),
        0,
      );
      tableRef.current.style.width = `${others + next}px`;
    }
  }
  function onResizeEnd(e: PointerEvent) {
    const d = drag.current;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    drag.current = null;
    if (!d) return;
    const next = Math.max(MIN_W, d.startW + (e.clientX - d.startX));
    setWidths((w) => {
      const updated = { ...w, [d.key]: next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }
  function onResizeStart(e: React.PointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { key, startX: e.clientX, startW: widths[key] ?? DEFAULTS[key] ?? 120 };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  }
  function resetColumn(key: string) {
    setWidths((w) => {
      const updated = { ...w, [key]: DEFAULTS[key] ?? 120 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }
  function resetAll() {
    setWidths(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const isCustomised = COLS.some(
    (c) => c.resizable && (widths[c.key] ?? c.width) !== c.width,
  );

  function href(r: InventoryRow) {
    return `/inventory/${encodeURIComponent(r.stock_number)}`;
  }

  // ---- j/k row navigation ----
  // j/k move a highlighted row, ⏎ opens it, x toggles its selection. Skipped
  // while typing so it never fights the filter box.
  const [activeRow, setActiveRow] = useState(-1);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (rows.length === 0) return;
      if (e.key === "j") {
        e.preventDefault();
        setActiveRow((a) => Math.min(a < 0 ? 0 : a + 1, rows.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setActiveRow((a) => Math.max(a < 0 ? 0 : a - 1, 0));
      } else if (e.key === "x" && rows[activeRow]) {
        e.preventDefault();
        toggleRow(rows[activeRow]!.id);
      } else if (e.key === "Enter" && rows[activeRow]) {
        e.preventDefault();
        router.push(href(rows[activeRow]!));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeRow]);
  useEffect(() => {
    if (activeRow >= 0) {
      rowRefs.current[activeRow]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeRow]);
  // Rows change (paging/sort/filter) → drop the highlight.
  useEffect(() => setActiveRow(-1), [rows]);

  function cell(col: Col, r: InventoryRow) {
    switch (col.key) {
      case "select":
        return (
          <input
            type="checkbox"
            aria-label={`Select ${r.stock_number}`}
            checked={selected.has(r.id)}
            onChange={() => toggleRow(r.id)}
            className="align-middle"
          />
        );
      case "image": {
        const thumb = thumbs[r.id];
        return (
          <Link href={href(r)} className="inline-block">
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="h-9 w-9 rounded-md object-cover" />
            ) : (
              <span
                className="jvb-hatch flex h-9 w-9 items-center justify-center rounded-md text-[11px] text-ink-soft"
                aria-label="No image"
              >
                ▦
              </span>
            )}
          </Link>
        );
      }
      case "stock_number":
        return (
          <span className="flex items-center gap-1.5 truncate font-mono text-[12px] text-ink">
            <Link href={href(r)}>{r.stock_number}</Link>
            {r.legacy_stock_number ? (
              <span className="text-ink-soft">({r.legacy_stock_number})</span>
            ) : null}
            <RegisterBadge ledger={r.ledger} size="xs" />
          </span>
        );
      case "title":
        return (
          <Link href={href(r)} className="flex items-center gap-1.5 truncate text-[13.5px] text-ink-body">
            {r.needs_completion ? (
              <span
                title="Captured on mobile — needs completion"
                className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em]"
                style={{ background: "var(--jvb-warn-soft)", color: "var(--jvb-warn)" }}
              >
                Finish
              </span>
            ) : null}
            <span className="truncate">{r.title ?? "Untitled"}</span>
          </Link>
        );
      case "maker_name":
        return (
          <span className="block truncate text-[13px] text-ink-muted">
            {r.maker_name ?? "—"}
            {r.maker_name && r.maker_dates ? (
              <span className="text-ink-soft"> ({r.maker_dates})</span>
            ) : null}
          </span>
        );
      case "category_name":
        return <span className="block truncate text-[13px] text-ink-muted">{r.category_name ?? "—"}</span>;
      case "location_code":
        return (
          <span className="block truncate text-[13px] text-ink-muted">
            {r.location_name ?? "—"}
          </span>
        );
      case "status":
        return <StatusPill status={r.status} variant="inline" />;
      default:
        return null;
    }
  }

  return (
    <div>
      {selected.size > 0 ? (
        <AddToListBar
          selectedIds={[...selected]}
          startedAt={startedAt}
          lists={lists}
          locations={locations}
          onClear={() => setSelected(new Set())}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      {/* Density and column-width controls only mean anything for the table,
          which is desktop-only — hide them where the cards render. */}
      <div className="mb-1.5 hidden items-center justify-end gap-3 md:flex">
        <span className="mr-auto hidden font-mono text-[10.5px] text-ink-faint lg:inline">
          j/k move · ⏎ open · x select
        </span>
        <button
          type="button"
          onClick={toggleDensity}
          className="text-[11.5px] text-ink-soft hover:text-ink-strong"
          title="Toggle row density"
        >
          {density === "compact" ? "Comfortable rows" : "Compact rows"}
        </button>
        {isCustomised ? (
          <button
            type="button"
            onClick={resetAll}
            className="text-[11.5px] text-ink-soft underline hover:text-ink-strong"
          >
            Reset column widths
          </button>
        ) : null}
      </div>

      {/* Mobile: a card list. The table is a fixed ~1100px grid with drag
          handles — on a phone that is three viewports of sideways scrolling and
          the handles are unusable by touch. Same data, one column, tappable. */}
      <ul className="overflow-hidden rounded-[11px] border border-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="border-b border-line-soft last:border-0">
            <div className="flex items-stretch">
              <label className="flex w-11 shrink-0 items-center justify-center border-r border-line-soft">
                <span className="sr-only">Select {r.stock_number}</span>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleRow(r.id)}
                  className="h-4 w-4 accent-[var(--jvb-bg-primary)]"
                />
              </label>
              <Link href={href(r)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                {thumbs[r.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbs[r.id]}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span
                    aria-label="No image"
                    className="jvb-hatch flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-[11px] text-ink-soft"
                  >
                    ▦
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[11.5px] text-ink-muted">{r.stock_number}</span>
                    <RegisterBadge ledger={r.ledger} size="xs" />
                    {r.needs_completion ? (
                      <span className="rounded-full bg-warn-soft px-1.5 text-[10px] font-medium text-warn">
                        Finish
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[13.5px] text-ink-body">
                    {r.title ?? "Untitled"}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-ink-soft">
                    {[r.maker_name, r.category_name, r.location_name].filter(Boolean).join(" · ") ||
                      "—"}
                  </span>
                  <span className="mt-1 block">
                    <StatusPill status={r.status} variant="inline" />
                  </span>
                </span>
              </Link>
            </div>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-ink-muted">No records match.</li>
        ) : null}
      </ul>

      <div className="hidden overflow-x-auto rounded-[11px] border border-line md:block lg:overflow-x-visible">
        <table
          ref={tableRef}
          style={{ width: totalWidth(), tableLayout: "fixed" }}
          className="min-w-full border-collapse bg-cell text-left"
        >
          <colgroup>
            {COLS.map((c) => (
              <col
                key={c.key}
                ref={(el) => {
                  colRefs.current[c.key] = el;
                }}
                style={{ width: c.resizable ? widths[c.key] ?? c.width : c.width }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {COLS.map((c) => {
                const isActive = activeSort === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ top: "var(--app-header-h, 88px)" }}
                    className={`relative select-none border-b border-line bg-cell px-4 py-2.5 font-medium lg:sticky lg:z-20 ${
                      c.align === "right" ? "text-right" : "text-left"
                    } ${c.key === "image" ? "px-3" : ""}`}
                    aria-label={c.key === "image" ? "Image" : undefined}
                  >
                    {c.key === "select" ? (
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="align-middle"
                      />
                    ) : c.sortable ? (
                      <button
                        type="button"
                        onClick={() => onHeaderClick(c.key)}
                        title="Click to sort · click again to reverse"
                        className={`inline-flex items-center gap-1 select-none hover:text-ink-mid ${
                          isActive ? "text-ink-strong" : ""
                        }`}
                      >
                        {c.label}
                        <SortIcon state={isActive ? activeDir : "none"} />
                      </button>
                    ) : (
                      c.label
                    )}
                    {c.resizable ? (
                      <span
                        onPointerDown={(e) => onResizeStart(e, c.key)}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          resetColumn(c.key);
                        }}
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${c.label} column`}
                        title="Drag to resize · double-click to reset"
                        className="group absolute inset-y-0 right-0 z-20 w-4 cursor-col-resize touch-none"
                      >
                        {/* visible divider at the column boundary (always faintly shown, orange on hover) */}
                        <span className="pointer-events-none absolute inset-y-[5px] right-0 w-[2px] rounded bg-line-control transition-colors group-hover:bg-oranje" />
                      </span>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`border-b border-line-soft last:border-0 hover:bg-control ${
                  i === activeRow ? "bg-oranje/10 ring-1 ring-inset ring-oranje/40" : ""
                }`}
              >
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`overflow-hidden px-4 align-middle ${rowPad} ${c.key === "image" ? "px-3 py-1" : ""}`}
                  >
                    {cell(c, r)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  No records match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Show the selection's age once it is older than this. */
const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour

/** "2 hours ago" / "1 hour ago" — coarse on purpose; precision isn't the point. */
function ageLabel(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function AddToListBar({
  selectedIds,
  startedAt,
  lists,
  locations,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  startedAt: number | null;
  lists: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [listId, setListId] = useState("");
  const [newName, setNewName] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed on a timer as well as on render, so a bar left open on screen
  // starts warning without needing a click. Rendered only after mount, so the
  // server and first client render agree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const age = now !== null && startedAt !== null ? now - startedAt : 0;
  const stale = age >= STALE_AFTER_MS;

  async function add() {
    if (!listId && !newName.trim()) {
      setError("Pick a list or enter a new name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/lists/add-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listId: listId || undefined,
          name: listId ? undefined : newName.trim(),
          pieceIds: selectedIds,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add to list");
      onDone();
      setListId("");
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to list");
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    if (!bulkStatus && !bulkLocation) {
      setError("Pick a status or a location to apply.");
      return;
    }
    const count = selectedIds.length;
    const label = STATUS_LABELS[bulkStatus] ?? bulkStatus;
    const parts = [
      bulkStatus ? `status → ${label}` : null,
      bulkLocation ? "a new location" : null,
    ].filter(Boolean);
    const staleNote = stale
      ? `\n\nThis selection was started ${ageLabel(age)}. Check it is still what you meant.`
      : "";
    if (
      !confirm(
        `Apply ${parts.join(" and ")} to ${count} selected work${count === 1 ? "" : "s"}?${staleNote}`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceIds: selectedIds,
          status: bulkStatus || undefined,
          locationId: bulkLocation || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not update");
      setBulkStatus("");
      setBulkLocation("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body";

  return (
    <div className="jvb-slide-enter mb-2 space-y-2 rounded-lg border border-oranje/30 bg-oranje/5 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-medium text-ink-body">
          {selectedIds.length} selected
        </span>
        {stale ? (
          <span
            title="This selection was started a while ago — worth checking it is still what you meant."
            className="rounded-full bg-warn-soft px-2 py-0.5 text-[11.5px] font-medium text-warn"
          >
            gathered {ageLabel(age)}
          </span>
        ) : null}
        <span className="text-[12px] text-ink-soft">→ add to</span>
        <select value={listId} onChange={(e) => setListId(e.target.value)} className={field}>
          <option value="">New list…</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {!listId ? (
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New list name"
            className={`${field} w-52`}
          />
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-[12px] text-ink-soft hover:text-ink-strong"
        >
          Clear selection
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-oranje/20 pt-2">
        <span className="text-[12px] text-ink-soft">Bulk edit</span>
        <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className={field}>
          <option value="">Set status…</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)} className={field}>
          <option value="">Move to location…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || (!bulkStatus && !bulkLocation)}
          onClick={() => void applyBulk()}
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-semibold text-ink-strong disabled:opacity-50"
        >
          {busy ? "Applying…" : "Apply"}
        </button>
      </div>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function SortIcon({ state }: { state: "asc" | "desc" | "none" }) {
  return (
    <svg
      aria-hidden
      width="7"
      height="11"
      viewBox="0 0 8 12"
      fill="none"
      className={`ml-0.5 ${state === "none" ? "text-ink-faint" : "text-ink-strong"}`}
    >
      <path
        d="M1.5 4.5 L4 2 L6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={state === "desc" ? 0.3 : 1}
      />
      <path
        d="M1.5 7.5 L4 10 L6.5 7.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={state === "asc" ? 0.3 : 1}
      />
    </svg>
  );
}
