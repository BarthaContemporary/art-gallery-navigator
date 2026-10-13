"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusPill, STATUS_LABELS } from "@/components/status-pill";
import { RegisterBadge } from "@/components/register-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { ArrowRightIcon, FlagIcon, ImageIcon } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/section";
import { ColumnResizer, SortMark, TableFrame, Td, rowClass, thClass } from "@/components/ui/table";
import { WebsiteDot } from "@/components/ui/website-switch";
import { cx } from "@/components/ui/cx";
import { useResizableColumns } from "@/hooks/use-resizable-columns";
import { titleWithYear } from "@jvb/db";

export type InventoryRow = {
  id: string;
  stock_number: string;
  legacy_stock_number: string | null;
  title: string | null;
  year: number | string | null;
  needs_completion?: boolean;
  maker_name: string | null;
  maker_dates: string | null;
  category_name: string | null;
  location_name: string | null;
  status: string;
  ledger?: "jvb" | "external";
  /** Temporarily flagged by the current user (see piece_flags). */
  flagged?: boolean;
  /** pieces.web_visible, for the optional Website column. */
  web_visible?: boolean;
};

type Col = {
  key: string;
  label: string;
  sortable: boolean;
  resizable: boolean;
  width: number; // default width (px)
};

// The image column is fixed; every other column is drag-resizable. Sort keys
// match the SORTABLE map in the inventory page so header clicks re-sort server-side.
const COLS: Col[] = [
  { key: "select", label: "Select", sortable: false, resizable: false, width: 40 },
  { key: "flag", label: "Flag", sortable: false, resizable: false, width: 40 },
  { key: "image", label: "Image", sortable: false, resizable: false, width: 56 },
  { key: "stock_number", label: "Stock", sortable: true, resizable: true, width: 130 },
  { key: "title", label: "Title", sortable: true, resizable: true, width: 300 },
  { key: "maker_name", label: "Maker", sortable: true, resizable: true, width: 170 },
  { key: "category_name", label: "Category", sortable: true, resizable: true, width: 150 },
  { key: "location_code", label: "Location", sortable: true, resizable: true, width: 120 },
  { key: "status", label: "Status", sortable: true, resizable: true, width: 130 },
];
/**
 * Whether a work is on the website, as a column the user switches on. Off by
 * default: most of the time the question is where a work is and whether it
 * is available, and the facet above answers "which are on the site".
 */
const WEB_COL: Col = { key: "web_visible", label: "Website", sortable: false, resizable: true, width: 96 };
/** Heads with no visible words (the checkbox, flag and image columns). */
const WORDLESS = new Set(["select", "flag", "image"]);
const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;

const MIN_W = 64;
const STORAGE_KEY = "jvb:inventory:colwidths:v2";
const DENSITY_KEY = "jvb:inventory:density:v1";
const WEB_COL_KEY = "jvb:inventory:webcol:v1";

/** What the selection bar just filed, for the notice that outlives the bar. */
type Filed = { listId: string; name: string; added: number; skipped: number };

export function InventoryTable({
  rows,
  thumbs,
  lists = [],
  locations = [],
  flagTotal = 0,
  showingFlagged = false,
}: {
  rows: InventoryRow[];
  thumbs: Record<string, string>;
  lists?: { id: string; name: string }[];
  locations?: { id: string; name: string }[];
  /** How many works the user has flagged in total (all pages). */
  flagTotal?: number;
  /** Whether the list is currently narrowed to flagged works. */
  showingFlagged?: boolean;
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
  /** The last "add to list" from the selection bar, until dismissed. */
  const [filed, setFiled] = useState<Filed | null>(null);

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

  // ---- temporary flags ----
  // Flags live in the database per user (so they follow you across devices
  // and pages); the table keeps a local mirror so a click highlights at once.
  const flaggedOnPage = () => new Set(rows.filter((r) => r.flagged).map((r) => r.id));
  const [flags, setFlags] = useState<Set<string>>(flaggedOnPage);
  const [flagCount, setFlagCount] = useState(flagTotal);
  useEffect(() => setFlags(flaggedOnPage()), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setFlagCount(flagTotal), [flagTotal]);
  const [flagError, setFlagError] = useState<string | null>(null);

  async function setFlagged(ids: string[], flagged: boolean) {
    const changing = ids.filter((id) => flags.has(id) !== flagged);
    if (changing.length === 0) return;
    const before = new Set(flags);
    const beforeCount = flagCount;
    setFlags((f) => {
      const n = new Set(f);
      changing.forEach((id) => (flagged ? n.add(id) : n.delete(id)));
      return n;
    });
    // Off-page flags can't change here, so the total moves by exactly the
    // on-page delta.
    setFlagCount((c) => Math.max(0, c + (flagged ? changing.length : -changing.length)));
    setFlagError(null);
    try {
      const res = await fetch("/api/inventory/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceIds: changing, flagged }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Could not save flag");
      // When viewing "flagged only", an unflagged row should drop out.
      if (showingFlagged && !flagged) router.refresh();
    } catch (e) {
      setFlags(before);
      setFlagCount(beforeCount);
      setFlagError(e instanceof Error ? e.message : "Could not save flag");
    }
  }
  const toggleFlag = (id: string) => void setFlagged([id], !flags.has(id));
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

  // ---- view settings: density and the optional Website column ----
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [showWeb, setShowWeb] = useState(false);

  // Load the persisted settings after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    try {
      if (localStorage.getItem(DENSITY_KEY) === "compact") setDensity("compact");
      if (localStorage.getItem(WEB_COL_KEY) === "on") setShowWeb(true);
    } catch {
      /* storage blocked: the defaults stand */
    }
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
  function toggleWebColumn() {
    setShowWeb((on) => {
      try {
        if (on) localStorage.removeItem(WEB_COL_KEY);
        else localStorage.setItem(WEB_COL_KEY, "on");
      } catch {
        /* ignore */
      }
      return !on;
    });
  }

  // Column widths: drag, ←/→ on a focused handle, double-click to reset;
  // remembered under STORAGE_KEY (hooks/use-resizable-columns). The Website
  // column's width is kept there too, under its own key.
  const columns = showWeb ? [...COLS, WEB_COL] : COLS;
  const cols = useResizableColumns(columns, { storageKey: STORAGE_KEY, minWidth: MIN_W });

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

  const isCustomised = cols.isCustomised;

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
      } else if (e.key === "f" && rows[activeRow]) {
        e.preventDefault();
        toggleFlag(rows[activeRow]!.id);
      } else if (e.key === "Enter" && rows[activeRow]) {
        e.preventDefault();
        router.push(href(rows[activeRow]!));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeRow, flags]);
  useEffect(() => {
    if (activeRow >= 0) {
      rowRefs.current[activeRow]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeRow]);
  // Rows change (paging/sort/filter) → drop the highlight.
  useEffect(() => setActiveRow(-1), [rows]);

  // ---- the head and the rows' frame, kept in step ----
  const headScroll = useRef<HTMLDivElement>(null);
  const bodyScroll = useRef<HTMLDivElement>(null);
  const bodyTable = useRef<HTMLTableElement>(null);
  /** The element this table last scrolled by script, and to where. */
  const scriptedScroll = useRef<{ el: HTMLElement | null; left: number }>({ el: null, left: 0 });

  /**
   * Copies one side's sideways scroll to the other. The scroll event that
   * the copy itself raises is recognised and ignored, so momentum on one
   * side is never pulled back by a late echo from the other.
   */
  function mirrorScroll(from: HTMLElement | null, to: HTMLElement | null) {
    if (!from || !to) return;
    const last = scriptedScroll.current;
    if (last.el === from && Math.abs(from.scrollLeft - last.left) < 1) return;
    if (to.scrollLeft === from.scrollLeft) return;
    scriptedScroll.current = { el: to, left: from.scrollLeft };
    to.scrollLeft = from.scrollLeft;
  }

  /**
   * A drag writes the head's <col> widths straight to the DOM (see
   * useResizableColumns) and commits on release; the rows' table copies
   * them every frame while the drag lasts, so the two never part.
   */
  function copyWidths() {
    const head = cols.tableRef.current;
    const body = bodyTable.current;
    if (!head || !body) return;
    if (body.style.width !== head.style.width) body.style.width = head.style.width;
    const headCols = head.querySelectorAll("col");
    const bodyCols = body.querySelectorAll("col");
    headCols.forEach((col, i) => {
      const target = bodyCols[i];
      if (target && target.style.width !== col.style.width) target.style.width = col.style.width;
    });
  }
  function resizeHandle(key: string, label: string) {
    const props = cols.handleProps(key, label);
    return {
      ...props,
      onPointerDown: (e: ReactPointerEvent) => {
        props.onPointerDown(e);
        let frame = requestAnimationFrame(function follow() {
          copyWidths();
          frame = requestAnimationFrame(follow);
        });
        const stop = () => {
          cancelAnimationFrame(frame);
          copyWidths();
          window.removeEventListener("pointerup", stop);
        };
        window.addEventListener("pointerup", stop);
      },
    };
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
            className="h-4 w-4 align-middle"
          />
        );
      case "flag":
        return <FlagButton flagged={flags.has(r.id)} stock={r.stock_number} onClick={() => toggleFlag(r.id)} />;
      case "image":
        // The title and stock number already link to the record; a second,
        // unnamed link per row would only add a blank tab stop.
        return (
          <Link href={href(r)} aria-hidden tabIndex={-1} className="block w-9">
            <Thumb src={thumbs[r.id]} size="h-9 w-9" />
          </Link>
        );
      case "stock_number":
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <Link href={href(r)} className="link-plain tabular truncate text-ink">
              {r.stock_number}
            </Link>
            {r.legacy_stock_number ? (
              <span className="tabular truncate text-meta">({r.legacy_stock_number})</span>
            ) : null}
            <RegisterBadge ledger={r.ledger} size="xs" />
          </span>
        );
      case "title":
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            {r.needs_completion ? (
              <Badge tone="warn" size="xs" title="Captured on mobile: needs completion">
                Finish
              </Badge>
            ) : null}
            <Link href={href(r)} className="link-plain truncate text-ink">
              {titleWithYear(r.title, r.year)}
            </Link>
          </span>
        );
      case "maker_name":
        return (
          <span className="block truncate text-body">
            {r.maker_name ?? "—"}
            {r.maker_name && r.maker_dates ? <span className="text-meta"> ({r.maker_dates})</span> : null}
          </span>
        );
      case "category_name":
        return <span className="block truncate text-body">{r.category_name ?? "—"}</span>;
      case "location_code":
        return <span className="block truncate text-body">{r.location_name ?? "—"}</span>;
      case "status":
        return <StatusPill status={r.status} variant="inline" />;
      case "web_visible":
        return <WebsiteDot on={Boolean(r.web_visible)} wordless />;
      default:
        return null;
    }
  }

  return (
    <div>
      {filed ? (
        <Notice
          tone="ok"
          className="mb-2"
          action={
            <Button variant="quiet" size="sm" className="text-body" onClick={() => setFiled(null)}>
              Dismiss
            </Button>
          }
        >
          Added {filed.added} work{filed.added === 1 ? "" : "s"} to{" "}
          <Link href={`/inventory/lists/${filed.listId}`} className="link inline-flex items-center gap-1">
            {filed.name}
            <ArrowRightIcon size={14} />
          </Link>
          {filed.skipped > 0
            ? `. ${filed.skipped} non-JvdB work${filed.skipped === 1 ? " was" : "s were"} left out (lists hold JvdB stock only).`
            : "."}
        </Notice>
      ) : null}

      {flagCount > 0 || showingFlagged ? (
        <FlagBar
          count={flagCount}
          lists={lists}
          showingFlagged={showingFlagged}
          flaggedOnPage={rows.filter((r) => flags.has(r.id)).length}
          onSelectFlaggedOnPage={() =>
            setSelected((s) => {
              const n = new Set(s);
              rows.forEach((r) => {
                if (flags.has(r.id)) n.add(r.id);
              });
              return n;
            })
          }
          onCleared={() => {
            setFlags(new Set());
            setFlagCount(0);
            router.refresh();
          }}
        />
      ) : null}
      {flagError ? (
        <Notice tone="danger" inline className="mb-2">
          {flagError}
        </Notice>
      ) : null}

      {selected.size > 0 ? (
        <AddToListBar
          selectedIds={[...selected]}
          startedAt={startedAt}
          lists={lists}
          locations={locations}
          flaggedCount={[...selected].filter((id) => flags.has(id)).length}
          onFlag={(flagged) => void setFlagged([...selected], flagged)}
          onClear={() => setSelected(new Set())}
          onAdded={setFiled}
          onDone={() => {
            setSelected(new Set());
            router.refresh();
          }}
        />
      ) : null}

      {/* The view settings only mean anything for the table, which is
          desktop-only — hide them where the cards render. */}
      <div className="mb-1 hidden items-center justify-end gap-1 md:flex">
        <p className="mr-auto hidden text-[11px] leading-[1.3] text-meta lg:block">
          <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>⏎</Kbd> open · <Kbd>x</Kbd> select · <Kbd>f</Kbd> flag
        </p>
        {/* The words say what a press does, as on the density toggle beside
            it, so there is no aria-pressed to contradict them (R5). */}
        <Button variant="quiet" size="sm" onClick={toggleWebColumn}>
          {showWeb ? "Hide website column" : "Show website column"}
        </Button>
        <Button variant="quiet" size="sm" onClick={toggleDensity} title="Toggle row density">
          {density === "compact" ? "Comfortable rows" : "Compact rows"}
        </Button>
        {isCustomised ? (
          <Button variant="quiet" size="sm" onClick={cols.resetAll}>
            Reset column widths
          </Button>
        ) : null}
      </div>

      {/* Mobile: a card list. The table is a fixed ~1100px grid with drag
          handles — on a phone that is three viewports of sideways scrolling and
          the handles are unusable by touch. Same data, one column, tappable. */}
      <ul className="border-t border-rule-strong md:hidden">
        {rows.map((r) => {
          const isSelected = selected.has(r.id);
          const isFlagged = flags.has(r.id);
          return (
            <li
              key={r.id}
              className={cx("relative border-b border-rule", isSelected && "bg-accent-wash")}
            >
              {/* The same row rules as the table: 3px warn when flagged,
                  2px accent when selected. */}
              {isFlagged || isSelected ? (
                <span
                  aria-hidden
                  className={cx("absolute inset-y-0 left-0", isFlagged ? "w-[3px] bg-warn" : "w-[2px] bg-accent")}
                />
              ) : null}
              <div className="flex items-stretch">
                <label className="flex w-11 shrink-0 items-center justify-center">
                  <span className="sr-only">Select {r.stock_number}</span>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(r.id)}
                    className="h-4 w-4"
                  />
                </label>
                <Link href={href(r)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1">
                  <Thumb src={thumbs[r.id]} size="h-12 w-12" lazy />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="tabular text-[12px] leading-[1.4] text-meta">{r.stock_number}</span>
                      <RegisterBadge ledger={r.ledger} size="xs" />
                      {r.needs_completion ? (
                        <Badge tone="warn" size="xs">
                          Finish
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px] leading-[1.45] text-ink">
                      {titleWithYear(r.title, r.year)}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] leading-[1.4] text-meta">
                      {[r.maker_name, r.category_name, r.location_name].filter(Boolean).join(" · ") || "—"}
                    </span>
                    <span className="mt-1 block text-[12px]">
                      <StatusPill status={r.status} variant="inline" />
                    </span>
                  </span>
                </Link>
                <span className="flex w-11 shrink-0 items-center justify-center">
                  <FlagButton flagged={isFlagged} stock={r.stock_number} onClick={() => toggleFlag(r.id)} large />
                </span>
              </div>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-[13px] leading-[1.45] text-body">
            No records match these filters.
          </li>
        ) : null}
      </ul>

      {/* The table, from md up. A wide table (the default columns are wider
          than an iPad in landscape, and widths are the user's to change)
          scrolls sideways inside its own frame and never moves the page.
          A head inside a scrolling frame cannot stick to the page, so the
          head is a table of its own above the frame: from lg it sticks
          under the app header, and it follows the frame's sideways scroll
          (both ways, so a swipe or Tab on the head moves the rows too).
          The two <table>s are one ARIA table (role="table" on the wrapper,
          rowgroup / row / columnheader / cell inside), so each cell is
          still read with its column's head. */}
      <div role="table" aria-label="Inventory" className="hidden md:block">
        <div
          ref={headScroll}
          onScroll={() => mirrorScroll(headScroll.current, bodyScroll.current)}
          data-inset-focus
          className="relative overflow-x-auto bg-page [scrollbar-width:none] lg:sticky lg:top-[var(--app-header-h,88px)] lg:z-20 [&::-webkit-scrollbar]:hidden"
        >
          <table
            ref={cols.tableRef}
            role="presentation"
            style={{ width: cols.totalWidth(), tableLayout: "fixed" }}
            className="min-w-full border-collapse bg-page text-left text-[13px] leading-[1.45]"
          >
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} ref={cols.colRef(c.key)} style={{ width: cols.widthOf(c.key) }} />
              ))}
            </colgroup>
            <thead role="rowgroup">
              <tr role="row">
                {columns.map((c) => {
                  const state = activeSort === c.key ? activeDir : "none";
                  return (
                    // Th's look (thClass), composed here so the resize handle
                    // sits beside the sort button rather than inside it.
                    <th
                      key={c.key}
                      role="columnheader"
                      scope="col"
                      aria-sort={c.sortable ? ARIA_SORT[state] : undefined}
                      className={thClass({}, "select-none")}
                    >
                      {c.key === "select" ? (
                        <input
                          type="checkbox"
                          aria-label="Select all on this page"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="h-4 w-4 align-middle"
                        />
                      ) : WORDLESS.has(c.key) ? (
                        <span className="sr-only">{c.label}</span>
                      ) : c.sortable ? (
                        <button
                          type="button"
                          onClick={() => onHeaderClick(c.key)}
                          title="Click to sort · click again to reverse"
                          className={cx(
                            "inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-ink",
                            state !== "none" && "text-ink",
                          )}
                        >
                          <span className="self-baseline">{c.label}</span>
                          <SortMark state={state} />
                        </button>
                      ) : (
                        c.label
                      )}
                      {c.resizable ? <ColumnResizer {...resizeHandle(c.key, c.label)} /> : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
        </div>

        {/* The rows' frame: scrolls sideways at any width the table is wider
            than; cells draw the focus ring inside (data-inset-focus). */}
        <TableFrame ref={bodyScroll} onScroll={() => mirrorScroll(bodyScroll.current, headScroll.current)}>
          <table
            ref={bodyTable}
            role="presentation"
            style={
              {
                width: cols.totalWidth(),
                tableLayout: "fixed",
                // Density is this table's own setting (DENSITY_KEY), so it sets
                // the row padding the Td cells read rather than the page's.
                "--jvb-row-py": density === "compact" ? "6px" : "10px",
              } as CSSProperties
            }
            className="min-w-full border-collapse bg-page text-left text-[13px] leading-[1.45]"
          >
            <colgroup>
              {columns.map((c) => (
                <col key={c.key} style={{ width: cols.widthOf(c.key) }} />
              ))}
            </colgroup>
            <tbody role="rowgroup">
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  role="row"
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  className={rowClass({
                    selected: selected.has(r.id),
                    flagged: flags.has(r.id),
                    current: i === activeRow,
                  })}
                >
                  {columns.map((c) => (
                    <Td key={c.key} role="cell" className="overflow-hidden">
                      {cell(c, r)}
                    </Td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                // EmptyRow's look, with the row and cell roles this ARIA
                // table needs.
                <tr role="row">
                  <td
                    role="cell"
                    colSpan={columns.length}
                    aria-colspan={columns.length}
                    className="border-b border-rule px-3 py-10 text-center"
                  >
                    <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.45] text-body">
                      No records match these filters.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableFrame>
      </div>
    </div>
  );
}

/** A square thumbnail, or a hatched square with an image mark when there is none. */
function Thumb({ src, size, lazy = false }: { src: string | undefined; size: string; lazy?: boolean }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading={lazy ? "lazy" : undefined} className={cx("shrink-0 object-cover", size)} />;
  }
  return (
    <span aria-hidden className={cx("jvb-hatch flex shrink-0 items-center justify-center text-meta", size)}>
      <ImageIcon size={14} />
    </span>
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
  flaggedCount,
  onFlag,
  onClear,
  onAdded,
  onDone,
}: {
  selectedIds: string[];
  startedAt: number | null;
  lists: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  /** How many of the selected works are currently flagged. */
  flaggedCount: number;
  onFlag: (flagged: boolean) => void;
  onClear: () => void;
  /** The list the selection went into, for the notice left behind. */
  onAdded: (filed: Filed) => void;
  onDone: () => void;
}) {
  const [listId, setListId] = useState("");
  const [newName, setNewName] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Delete is the one action here that cannot be undone by repeating it, so it
  // gets a panel of its own rather than a browser confirm() that a fast hand
  // dismisses by reflex.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [countTyped, setCountTyped] = useState("");

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
      const json = (await res.json()) as { error?: string; listId?: string; added?: number; skipped?: number };
      if (!res.ok) throw new Error(json.error ?? "Could not add to list");
      // Say where the works went: the bar closes with the selection, so the
      // confirmation has to live in the table above it.
      if (json.listId) {
        onAdded({
          listId: json.listId,
          name: listId ? lists.find((l) => l.id === listId)?.name ?? "the list" : newName.trim(),
          added: json.added ?? selectedIds.length,
          skipped: json.skipped ?? 0,
        });
      }
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

  async function deleteSelected() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pieceIds: selectedIds, action: "delete" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not delete");
      setConfirmingDelete(false);
      setCountTyped("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  const n = selectedIds.length;

  return (
    // The bulk bar is a Panel (spec section 4) with the selection's accent
    // rule down its edge, the same mark the selected rows carry.
    <Panel className="mb-2 border-l-2 border-l-accent">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-medium leading-[1.45] text-ink" aria-live="polite">
          {n} selected
        </p>
        {stale ? (
          <Badge tone="warn" title="This selection was started a while ago. Check it is still what you meant.">
            Gathered {ageLabel(age)}
          </Badge>
        ) : null}
        <Button variant="quiet" size="sm" onClick={onClear} className="ml-auto">
          Clear selection
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Add to list" className="w-48">
            <Select fieldSize="sm" value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">New list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          {!listId ? (
            <Field label="New list name" className="w-48">
              <Input fieldSize="sm" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Field>
          ) : null}
          <Button size="sm" disabled={busy} pending={busy} pendingLabel="Adding…" onClick={() => void add()}>
            Add
          </Button>
        </div>

        {/* Flag / unflag the whole selection — the group form of the row flag. */}
        <div className="flex items-end gap-2">
          <Button
            size="sm"
            icon={<FlagIcon size={14} />}
            disabled={busy || flaggedCount === n}
            onClick={() => onFlag(true)}
          >
            Flag
          </Button>
          <Button size="sm" disabled={busy || flaggedCount === 0} onClick={() => onFlag(false)}>
            Unflag
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Field label="Set status" className="w-40">
            <Select fieldSize="sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              <option value="">Unchanged</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Move to location" className="w-48">
            <Select fieldSize="sm" value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)}>
              <option value="">Unchanged</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            size="sm"
            disabled={busy || (!bulkStatus && !bulkLocation)}
            onClick={() => void applyBulk()}
          >
            {busy ? "Applying…" : "Apply"}
          </Button>
        </div>

        <Button
          variant="danger"
          size="sm"
          disabled={busy}
          aria-expanded={confirmingDelete}
          onClick={() => {
            setCountTyped("");
            setConfirmingDelete((v) => !v);
          }}
          className="sm:ml-auto"
        >
          Delete…
        </Button>
      </div>

      {confirmingDelete ? (
        <div className="mt-3 border-l-[3px] border-danger bg-danger-wash p-3">
          <p className="text-[13px] leading-[1.45] text-body">
            Delete{" "}
            <strong className="font-semibold text-ink">
              {n} work{n === 1 ? "" : "s"}
            </strong>
            ? They move to the recycle bin and can be restored from{" "}
            <Link href="/inventory/trash" className="underline underline-offset-2">
              Inventory, Trash
            </Link>{" "}
            for 30 days, after which they are removed for good.
          </p>
          {stale ? (
            <p className="mt-1.5 text-[12px] leading-[1.4] text-body">
              This selection was started {ageLabel(age)}. Check it is still what you meant.
            </p>
          ) : null}
          {/*
            Typing the count is the double-check. A second button would be
            dismissed by the same reflex as the first; a number that has to
            match forces you to read how many records this actually affects.
          */}
          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="bulk-delete-count" className="text-[12px] leading-[1.4] text-body">
                Type <strong className="tabular font-semibold text-ink">{n}</strong> to confirm
              </label>
              <input
                id="bulk-delete-count"
                value={countTyped}
                onChange={(e) => setCountTyped(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                className="field field-sm w-24 bg-page"
              />
            </div>
            <Button
              variant="danger"
              size="sm"
              disabled={busy || countTyped.trim() !== String(n)}
              pending={busy}
              pendingLabel="Deleting…"
              onClick={() => void deleteSelected()}
            >
              Delete
            </Button>
            <Button size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" inline className="mt-3">
          {error}
        </Notice>
      ) : null}
    </Panel>
  );
}

/** The row flag: a filled warn flag when set, an outline until hovered otherwise. */
function FlagButton({
  flagged,
  stock,
  onClick,
  large = false,
}: {
  flagged: boolean;
  stock: string;
  onClick: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      // One name with aria-pressed carrying the state, as on the record page:
      // a name that also changed read as "Remove flag, pressed".
      aria-pressed={flagged}
      aria-label={`Flag ${stock}`}
      title={flagged ? "Flagged: click to remove" : "Flag this work (f)"}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center transition-colors duration-150",
        large ? "h-11 w-11" : "h-7 w-7",
        flagged ? "text-warn" : "text-meta hover:text-warn",
      )}
    >
      {/* Filled when set, so the state is a change of shape as well as of
          colour. */}
      <FlagIcon size={large ? 18 : 16} className={flagged ? "fill-current" : undefined} />
    </button>
  );
}

/**
 * The flagged set, as a whole: how many, show only those, file them into a
 * list (existing or new) and optionally clear the flags once filed.
 */
function FlagBar({
  count,
  lists,
  showingFlagged,
  flaggedOnPage,
  onSelectFlaggedOnPage,
  onCleared,
}: {
  count: number;
  lists: { id: string; name: string }[];
  showingFlagged: boolean;
  flaggedOnPage: number;
  onSelectFlaggedOnPage: () => void;
  onCleared: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [listId, setListId] = useState("");
  const [newName, setNewName] = useState("");
  const [clearAfter, setClearAfter] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ listId: string; added: number; skipped: number; name: string } | null>(null);

  function toggleShowFlagged() {
    const p = new URLSearchParams(params.toString());
    if (showingFlagged) p.delete("flagged");
    else p.set("flagged", "1");
    p.delete("page");
    const q = p.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  }

  async function fileIntoList() {
    if (!listId && !newName.trim()) {
      setError("Pick a list or enter a new name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toList",
          listId: listId || undefined,
          name: listId ? undefined : newName.trim(),
          clear: clearAfter,
        }),
      });
      const json = (await res.json()) as { error?: string; listId?: string; added?: number; skipped?: number };
      if (!res.ok || !json.listId) throw new Error(json.error ?? "Could not add to list");
      setDone({
        listId: json.listId,
        added: json.added ?? 0,
        skipped: json.skipped ?? 0,
        name: listId ? lists.find((l) => l.id === listId)?.name ?? "the list" : newName.trim(),
      });
      setListId("");
      setNewName("");
      if (clearAfter) onCleared();
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to list");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm(`Remove all ${count} flag${count === 1 ? "" : "s"}? The works themselves are untouched.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Could not clear flags");
      setDone(null);
      onCleared();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear flags");
    } finally {
      setBusy(false);
    }
  }

  return (
    // A Panel with the flag's 3px warn rule, the mark flagged rows carry.
    <Panel className="mb-2 border-l-[3px] border-l-warn">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium leading-[1.45] text-ink">
          <FlagIcon size={16} className="fill-current text-warn" />
          {count} flagged
          {flaggedOnPage > 0 && flaggedOnPage !== count ? (
            <span className="font-normal text-meta">, {flaggedOnPage} on this page</span>
          ) : null}
        </p>
        <Button size="sm" onClick={toggleShowFlagged}>
          {showingFlagged ? "Show all records" : "Show flagged only"}
        </Button>
        {flaggedOnPage > 0 ? (
          <Button
            size="sm"
            onClick={onSelectFlaggedOnPage}
            title="Tick every flagged work on this page, for a bulk edit"
          >
            Select flagged on this page
          </Button>
        ) : null}
        <Button
          variant="quiet"
          size="sm"
          disabled={busy || count === 0}
          onClick={() => void clearAll()}
          className="ml-auto"
        >
          Clear all flags
        </Button>
      </div>

      {count > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="File flagged works into" className="w-52">
            <Select fieldSize="sm" value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">New list…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          {!listId ? (
            <Field label="New list name" className="w-52">
              <Input fieldSize="sm" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </Field>
          ) : null}
          <Button size="sm" disabled={busy} pending={busy} pendingLabel="Adding…" onClick={() => void fileIntoList()}>
            Add {count} to list
          </Button>
          <Checkbox
            label="Clear the flags afterwards"
            checked={clearAfter}
            onChange={(e) => setClearAfter(e.target.checked)}
            className="mb-1.5"
          />
        </div>
      ) : null}

      {done ? (
        <Notice tone="ok" inline className="mt-3">
          <span>
            Added {done.added} work{done.added === 1 ? "" : "s"} to{" "}
            <Link href={`/inventory/lists/${done.listId}`} className="link">
              {done.name}
            </Link>
            {done.skipped > 0
              ? `. ${done.skipped} non-JvdB work${done.skipped === 1 ? " was" : "s were"} skipped (lists hold JvdB stock only).`
              : "."}
          </span>
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" inline className="mt-3">
          {error}
        </Notice>
      ) : null}
    </Panel>
  );
}
