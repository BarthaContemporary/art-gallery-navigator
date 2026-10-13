"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Drag-resizable table columns with widths remembered per browser, shared by
 * the inventory and stock-book tables (and any table after them).
 *
 * Storage is unchanged from the copies this replaces: one localStorage key
 * per table (the caller's, e.g. "jvb:inventory:colwidths:v2"), holding the
 * whole width map as JSON, removed on "Reset column widths". Saved widths
 * therefore survive the move.
 *
 * During a drag the <col> and <table> widths are written to the DOM directly
 * and React state is committed once on release, so a wide table does not
 * re-render on every pointer move. A focused separator also takes ←/→ (16px,
 * 64px with Shift), so the columns can be resized from the keyboard.
 *
 * Use:
 *   const cols = useResizableColumns(COLUMNS, { storageKey: "jvb:…:v1", minWidth: 64 });
 *   <table ref={cols.tableRef} style={{ width: cols.totalWidth(), tableLayout: "fixed" }}>
 *     <colgroup>{COLUMNS.map((c) => <col key={c.key} ref={cols.colRef(c.key)} style={{ width: cols.widthOf(c.key) }} />)}</colgroup>
 *     … <th className="relative"> … <ColumnResizer {...cols.handleProps(c.key, c.label)} /></th>
 *   cols.isCustomised / cols.resetAll() for the "Reset column widths" link.
 */
export type ResizableColumn = {
  key: string;
  /** Default width in px. */
  width: number;
  /** False for fixed columns (checkbox, thumbnail). Default true. */
  resizable?: boolean;
};

const STEP = 16;
const STEP_LARGE = 64;

export function useResizableColumns(
  columns: ResizableColumn[],
  { storageKey, minWidth = 64, maxWidth = 1600 }: { storageKey: string; minWidth?: number; maxWidth?: number },
) {
  // Keyed on the column shape, so a caller may build the array in render.
  const shape = columns.map((c) => `${c.key}:${c.width}:${c.resizable !== false}`).join("|");
  const defaults = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.width])) as Record<string, number>,
    [shape], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fixed = useMemo(
    () => new Set(columns.filter((c) => c.resizable === false).map((c) => c.key)),
    [shape], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [widths, setWidths] = useState<Record<string, number>>(defaults);
  // The latest widths for the window listeners of a drag in progress.
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const tableRef = useRef<HTMLTableElement | null>(null);
  const colEls = useRef<Record<string, HTMLTableColElement | null>>({});
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Load saved widths after mount (reading storage during render would not
  // match the server's HTML).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (saved && typeof saved === "object") setWidths((w) => ({ ...w, ...saved }));
    } catch {
      /* ignore malformed storage */
    }
  }, [storageKey]);

  const widthOf = (key: string, from: Record<string, number> = widths) =>
    fixed.has(key) ? (defaults[key] ?? 100) : (from[key] ?? defaults[key] ?? 100);
  const totalWidth = () => columns.reduce((s, c) => s + widthOf(c.key), 0);
  const isCustomised = columns.some((c) => c.resizable !== false && widthOf(c.key) !== c.width);
  const clamp = (w: number) => Math.min(maxWidth, Math.max(minWidth, w));

  /** Sets one width and stores the whole map, as the tables always did. */
  function commit(key: string, next: number) {
    setWidths((w) => {
      const updated = { ...w, [key]: next };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const next = clamp(d.startW + (e.clientX - d.startX));
    const col = colEls.current[d.key];
    if (col) col.style.width = `${next}px`;
    if (tableRef.current) {
      const others = columns.reduce((s, c) => s + (c.key === d.key ? 0 : widthOf(c.key, widthsRef.current)), 0);
      tableRef.current.style.width = `${others + next}px`;
    }
  }
  function onEnd(e: PointerEvent) {
    const d = drag.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    drag.current = null;
    if (!d) return;
    commit(d.key, clamp(d.startW + (e.clientX - d.startX)));
  }
  function onStart(e: ReactPointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { key, startX: e.clientX, startW: widthOf(key) };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
  }

  function resetColumn(key: string) {
    commit(key, defaults[key] ?? 100);
  }
  function resetAll() {
    setWidths(defaults);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  /** Props for the separator in a column's head (spread onto ColumnResizer). */
  function handleProps(key: string, label: string) {
    const w = widthOf(key);
    return {
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": `Resize ${label} column`,
      "aria-valuenow": Math.min(maxWidth, w),
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      tabIndex: 0,
      title: "Drag or press ← → to resize · double-click to reset",
      onPointerDown: (e: ReactPointerEvent) => onStart(e, key),
      onDoubleClick: (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        resetColumn(key);
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        const step = (e.shiftKey ? STEP_LARGE : STEP) * (e.key === "ArrowLeft" ? -1 : 1);
        commit(key, clamp(w + step));
      },
    };
  }

  return {
    widths,
    widthOf: (key: string) => widthOf(key),
    totalWidth,
    isCustomised,
    tableRef,
    /** A ref callback for the column's <col>, which a drag resizes directly. */
    colRef: (key: string) => (el: HTMLTableColElement | null) => {
      colEls.current[key] = el;
    },
    handleProps,
    resetColumn,
    resetAll,
  };
}
