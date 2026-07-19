"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill } from "@/components/status-pill";

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
const DEFAULTS: Record<string, number> = Object.fromEntries(
  COLS.map((c) => [c.key, c.width]),
);

export function InventoryTable({
  rows,
  thumbs,
  lists = [],
}: {
  rows: InventoryRow[];
  thumbs: Record<string, string>;
  lists?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeSort = params.get("sort");
  const activeDir = (params.get("dir") ?? "asc") as "asc" | "desc";

  // ---- multi-select (add pieces to a list) ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const tableRef = useRef<HTMLTableElement | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Load persisted widths after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved && typeof saved === "object") {
        setWidths((w) => ({ ...w, ...saved }));
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

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
          <span className="block truncate font-mono text-[12px] text-ink">
            <Link href={href(r)}>{r.stock_number}</Link>
            {r.legacy_stock_number ? (
              <span className="ml-1.5 text-ink-soft">({r.legacy_stock_number})</span>
            ) : null}
          </span>
        );
      case "title":
        return (
          <Link href={href(r)} className="flex items-center gap-1.5 truncate text-[13.5px] text-ink-body">
            {r.needs_completion ? (
              <span
                title="Captured on mobile — needs completion"
                className="shrink-0 rounded bg-oranje px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-white"
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
        return <StatusPill status={r.status} />;
      default:
        return null;
    }
  }

  return (
    <div>
      {selected.size > 0 ? (
        <AddToListBar
          selectedIds={[...selected]}
          lists={lists}
          onClear={() => setSelected(new Set())}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      {isCustomised ? (
        <div className="mb-1.5 flex justify-end">
          <button
            type="button"
            onClick={resetAll}
            className="text-[11.5px] text-ink-soft underline hover:text-ink-strong"
          >
            Reset column widths
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[11px] border border-line">
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
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {COLS.map((c) => {
                const isActive = activeSort === c.key;
                return (
                  <th
                    key={c.key}
                    className={`relative select-none px-4 py-2.5 font-medium ${
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
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                {COLS.map((c) => (
                  <td
                    key={c.key}
                    className={`overflow-hidden px-4 py-2.5 align-middle ${c.key === "image" ? "px-3 py-2" : ""}`}
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

function AddToListBar({
  selectedIds,
  lists,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  lists: { id: string; name: string }[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [listId, setListId] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-oranje/30 bg-oranje/5 px-3 py-2">
      <span className="text-[12.5px] font-medium text-ink-body">
        {selectedIds.length} selected
      </span>
      <span className="text-[12px] text-ink-soft">→ add to</span>
      <select
        value={listId}
        onChange={(e) => setListId(e.target.value)}
        className="rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body"
      >
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
          className="w-52 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px] text-ink-body"
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
        className="text-[12px] text-ink-soft hover:text-ink-strong"
      >
        Clear
      </button>
      {error ? <span className="text-[12px] text-ink-body">{error}</span> : null}
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
