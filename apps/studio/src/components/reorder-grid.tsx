"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/*
 * Drag-to-reorder, shared by every surface that has a hand-set order: piece
 * images, inventory lists, contact lists, categories and locations.
 *
 * Built on Pointer Events rather than HTML5 drag-and-drop, because dragstart
 * never fires on iOS or Android — and these screens get used on an iPad while
 * photographing stock at a fair. One code path covers mouse, trackpad and touch.
 *
 * Dragging is by a grip handle, not the whole card. Cards carry their own
 * controls — rotate, delete, rename, merge — and making the card draggable would
 * mean guessing whether a press was a drag or a tap on one of those. Guessing
 * wrong either eats a click or starts a drag nobody asked for.
 *
 * Items are rendered on the server and handed over as nodes keyed by id. This
 * component owns nothing but their order, so every control inside keeps working
 * exactly as it did.
 */

type Ctx = {
  startDrag: (id: string) => void;
  nudge: (id: string, delta: number) => void;
  registerRow: (id: string, el: HTMLElement | null) => void;
  dragId: string | null;
  count: number;
  indexOf: (id: string) => number;
};

const ReorderCtx = createContext<Ctx | null>(null);

/**
 * The grip. Rendered by ReorderGrid itself in the card layouts; placed by hand
 * inside the item for the table layout, where there is nowhere to overlay it.
 */
export function ReorderHandle({ id, className = "" }: { id: string; className?: string }) {
  const ctx = useContext(ReorderCtx);
  if (!ctx) return null;
  const i = ctx.indexOf(id);
  return (
    <button
      type="button"
      // Register the row this handle sits in, so the grid can hit-test it.
      // Walking up beats wrapping the row: a <tr> inside a <tr> is invalid, and
      // display:contents (the trick that would hide such a wrapper) makes
      // getBoundingClientRect return 0×0, which would break hit-testing
      // outright.
      ref={(el) => ctx.registerRow(id, el?.closest("tr") ?? null)}
      aria-label={`Reorder item ${i + 1} of ${ctx.count}`}
      title="Drag to reorder — or focus and use ← →"
      onPointerDown={() => ctx.startDrag(id)}
      onKeyDown={(e) => {
        const d = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : 0;
        if (d === 0) return;
        e.preventDefault();
        ctx.nudge(id, d);
      }}
      // touch-none is what stops a touch-drag scrolling the page instead of
      // moving the item.
      className={`min-h-[28px] cursor-grab touch-none rounded-md border border-line-control bg-cell/90 px-1.5 text-[13px] leading-none text-ink-soft active:cursor-grabbing ${className}`}
    >
      ⠿
    </button>
  );
}

export function ReorderGrid({
  order: serverOrder,
  tiles,
  onReorder,
  className = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
  hint = "Drag a grip to reorder.",
  gripClassName = "absolute left-2 top-2 z-20",
  showPosition = true,
  variant = "grid",
}: {
  /** Ids in their persisted order. */
  order: string[];
  /** Server-rendered node per id. */
  tiles: Record<string, React.ReactNode>;
  /** Persists a new order. Called once, on drop. */
  onReorder: (ids: string[]) => Promise<void>;
  /** Container layout — a grid of cards, or a single column. */
  className?: string;
  hint?: string;
  /** Where the grip sits relative to the item. */
  gripClassName?: string;
  showPosition?: boolean;
  /**
   * "grid" wraps each item in an <li> and overlays the grip.
   * "rows" renders a <tbody> of the items untouched — each is already a <tr> —
   * and the page places <ReorderHandle> inside its own leading cell.
   */
  variant?: "grid" | "rows";
}) {
  const [order, setOrder] = useState(serverOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The server's order wins whenever it changes underneath us — an upload, a
  // delete, a revalidate. Without this a stale local order would resurrect
  // images that are gone.
  const serverKey = serverOrder.join(",");
  const lastServerKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey !== lastServerKey.current) {
      lastServerKey.current = serverKey;
      setOrder(serverOrder);
    }
  }, [serverKey, serverOrder]);

  const cellRefs = useRef(new Map<string, HTMLElement>());
  const orderAtDragStart = useRef<string[]>([]);

  /** Which tile is under the pointer right now. */
  const idAtPoint = useCallback((x: number, y: number): string | null => {
    for (const [id, el] of cellRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  function startDrag(id: string) {
    orderAtDragStart.current = order;
    setDragId(id);
  }

  const persist = useCallback(
    async (next: string[], revertTo: string[]) => {
      setSaving(true);
      try {
        await onReorder(next);
      } catch {
        setOrder(revertTo); // put it back rather than show an order that did not save
      } finally {
        setSaving(false);
      }
    },
    [onReorder],
  );

  /*
   * Move and release are tracked on the window, NOT via setPointerCapture on
   * the handle.
   *
   * Capture is released the moment the captured element moves in the DOM, and
   * reordering moves it — React re-keys the children and the browser drops the
   * capture. The drag would take one step and then go dead, because subsequent
   * pointermove events would target whatever now sits under the cursor instead
   * of the handle. Verified in Chromium before rewriting it this way.
   *
   * Window listeners have neither problem, and they also catch a release that
   * happens outside the grid.
   */
  useEffect(() => {
    if (!dragId) return;

    const onMove = (e: PointerEvent) => {
      const overId = idAtPoint(e.clientX, e.clientY);
      if (!overId || overId === dragId) return;
      setOrder((prev) => {
        const from = prev.indexOf(dragId);
        const to = prev.indexOf(overId);
        if (from < 0 || to < 0) return prev;
        const next = [...prev];
        next.splice(to, 0, ...next.splice(from, 1));
        return next;
      });
    };

    const onUp = () => {
      setDragId(null);
      setOrder((finalOrder) => {
        const before = orderAtDragStart.current;
        if (finalOrder.join(",") !== before.join(",")) void persist(finalOrder, before);
        return finalOrder;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, idAtPoint, persist]);

  /**
   * Keyboard equivalent. A drag has none, and the arrow buttons this replaces
   * were tab-reachable — losing that to gain a nicer gesture would be a poor
   * trade.
   */
  const nudge = useCallback(
    (id: string, delta: number) => {
      setOrder((cur) => {
        const from = cur.indexOf(id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= cur.length) return cur;
        const next = [...cur];
        next.splice(to, 0, ...next.splice(from, 1));
        void persist(next, cur);
        return next;
      });
    },
    [persist],
  );

  const ctx: Ctx = {
    startDrag,
    nudge,
    registerRow: (id, el) => {
      if (el) cellRefs.current.set(id, el);
      else cellRefs.current.delete(id);
    },
    dragId,
    count: order.length,
    indexOf: (id) => order.indexOf(id),
  };

  if (variant === "rows") {
    return (
      <ReorderCtx.Provider value={ctx}>
        {/* Each item already is a <tr>, so it goes straight in. */}
        <tbody>{order.map((id) => tiles[id])}</tbody>
      </ReorderCtx.Provider>
    );
  }

  return (
    <ReorderCtx.Provider value={ctx}>
      <p className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
        <span>{hint}</span>
        <span aria-live="polite" className={saving ? "text-ink-muted" : "sr-only"}>
          {saving ? "Saving order…" : ""}
        </span>
      </p>

      <ul className={`mt-2 ${className}`}>
        {order.map((id, i) => (
          <li
            key={id}
            ref={(el) => {
              if (el) cellRefs.current.set(id, el);
              else cellRefs.current.delete(id);
            }}
            className={`relative rounded-[9px] ${dragId === id ? "z-10 opacity-60" : ""}`}
          >
            <span className={`${gripClassName} flex items-center gap-1`}>
              <button
                type="button"
                aria-label={`Reorder item ${i + 1} of ${order.length}`}
                title="Drag to reorder — or focus and use ← →"
                onPointerDown={() => startDrag(id)}
                onKeyDown={(e) => {
                  const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                  if (d === 0) return;
                  e.preventDefault();
                  nudge(id, d);
                }}
                // touch-none is what stops a touch-drag scrolling the page
                // instead of moving the tile.
                className="min-h-[28px] cursor-grab touch-none rounded-md border border-line-control bg-cell/90 px-1.5 text-[13px] leading-none text-ink-soft active:cursor-grabbing"
              >
                ⠿
              </button>
              {showPosition ? (
                <span className="rounded-md bg-cell/90 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
                  {i + 1}
                </span>
              ) : null}
            </span>
            {tiles[id]}
          </li>
        ))}
      </ul>
    </ReorderCtx.Provider>
  );
}
