"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripIcon } from "@/components/ui/icons";
import { arrowDelta, moveBy, moveOver, sameOrder } from "@/lib/order-move";

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
 *
 * Keyboard: a focused grip moves its item with the arrow keys (Left/Up back,
 * Right/Down forward) in every layout. The key stops there: a page's own
 * arrow-key shortcuts (RecordKeyNav's previous/next work on the images page)
 * must not also act on it. A save that fails puts the order back and says so
 * in the status line (the table layout shows it in a notice of its own).
 */
const ORDER_SAVE_FAILED = "Couldn’t save the order, so it has been put back. Try again.";

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
 * The grip's look: a square in the hairline frame on the page ground. Hover
 * gives the ink frame and words; held, it takes the ink fill, so the item in
 * hand is plain to see. touch-none is what stops a touch-drag scrolling the
 * page instead of moving the item.
 */
const GRIP =
  "inline-flex min-h-[28px] cursor-grab touch-none items-center border border-rule-strong bg-page/90 px-1 text-meta transition-[color,border-color,background-color] duration-150 hover:border-ink hover:text-ink active:cursor-grabbing active:border-ink active:bg-ink active:text-page";

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
      title="Drag to reorder, or focus it and use the arrow keys"
      onPointerDown={() => ctx.startDrag(id)}
      onKeyDown={(e) => {
        const d = arrowDelta(e.key);
        if (d === 0) return;
        // Handled here: no scroll, and no page shortcut on the same key.
        e.preventDefault();
        e.stopPropagation();
        ctx.nudge(id, d);
      }}
      // touch-none is what stops a touch-drag scrolling the page instead of
      // moving the item.
      className={`${GRIP} ${className}`}
    >
      <GripIcon size={16} />
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
  const [order, setOrder] = useState<readonly string[]>(serverOrder);
  // The order as it is now, for handlers whose closure is older (a drag's
  // release, a nudge right after another): kept in step with every change.
  const orderRef = useRef<readonly string[]>(serverOrder);
  const apply = useCallback((next: readonly string[]) => {
    orderRef.current = next;
    setOrder(next);
  }, []);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The server's order wins whenever it changes underneath us — an upload, a
  // delete, a revalidate. Without this a stale local order would resurrect
  // images that are gone.
  const serverKey = serverOrder.join(",");
  const lastServerKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey !== lastServerKey.current) {
      lastServerKey.current = serverKey;
      apply(serverOrder);
    }
  }, [serverKey, serverOrder, apply]);

  const cellRefs = useRef(new Map<string, HTMLElement>());
  const orderAtDragStart = useRef<readonly string[]>([]);

  /** Which tile is under the pointer right now. */
  const idAtPoint = useCallback((x: number, y: number): string | null => {
    for (const [id, el] of cellRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return id;
    }
    return null;
  }, []);

  function startDrag(id: string) {
    orderAtDragStart.current = orderRef.current;
    setDragId(id);
  }

  // Each save is numbered: quick nudges put several on the wire, and a late
  // failure of an early one must not put back an order older than what a
  // newer save has since stored. Only the newest save reverts or reports.
  const saves = useRef(0);
  const persist = useCallback(
    async (next: readonly string[], revertTo: readonly string[]) => {
      const mine = ++saves.current;
      setSaving(true);
      setSaveError(null);
      try {
        await onReorder([...next]);
      } catch {
        if (mine === saves.current) {
          apply(revertTo); // put it back rather than show an order that did not save
          setSaveError(ORDER_SAVE_FAILED);
        }
      } finally {
        if (mine === saves.current) setSaving(false);
      }
    },
    [onReorder, apply],
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
      const next = moveOver(orderRef.current, dragId, overId);
      if (next !== orderRef.current) apply(next);
    };

    // The order is worked out here, outside any state updater (which React
    // may run twice), so a drop saves once.
    const onUp = () => {
      setDragId(null);
      const finalOrder = orderRef.current;
      const before = orderAtDragStart.current;
      if (!sameOrder(finalOrder, before)) void persist(finalOrder, before);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragId, idAtPoint, persist, apply]);

  /**
   * Keyboard equivalent. A drag has none, and the arrow buttons this replaces
   * were tab-reachable — losing that to gain a nicer gesture would be a poor
   * trade. The next order is computed from the current one before the state
   * changes, so each press saves exactly once.
   */
  const nudge = useCallback(
    (id: string, delta: number) => {
      const cur = orderRef.current;
      const next = moveBy(cur, id, delta);
      if (next === cur) return;
      apply(next);
      void persist(next, cur);
    },
    [persist, apply],
  );

  // The table layout renders only a <tbody>, with no room for a status line,
  // so its "saving" and "couldn't save" go to a small notice of their own.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

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
        {portalReady
          ? createPortal(
              <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-40 max-w-[min(92vw,420px)]">
                {saveError ? (
                  <p role="alert" className="notice pointer-events-auto" data-tone="danger">
                    {saveError}
                  </p>
                ) : saving ? (
                  <p className="sr-only">Saving order…</p>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </ReorderCtx.Provider>
    );
  }

  return (
    <ReorderCtx.Provider value={ctx}>
      <p className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
        <span>{hint}</span>
        <span
          aria-live="polite"
          className={saveError ? "text-danger" : saving ? "text-ink-muted" : "sr-only"}
        >
          {saveError ?? (saving ? "Saving order…" : "")}
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
            className={`relative ${dragId === id ? "z-10 opacity-60" : ""}`}
          >
            <span className={`${gripClassName} flex items-center gap-1`}>
              <button
                type="button"
                aria-label={`Reorder item ${i + 1} of ${order.length}`}
                title="Drag to reorder, or focus it and use the arrow keys"
                onPointerDown={() => startDrag(id)}
                onKeyDown={(e) => {
                  // All four arrows: the card layout also serves single
                  // columns (the offer items), where Up and Down are natural.
                  const d = arrowDelta(e.key);
                  if (d === 0) return;
                  // Handled here: no scroll, and no page shortcut on the same
                  // key (RecordKeyNav would otherwise open the next work).
                  e.preventDefault();
                  e.stopPropagation();
                  nudge(id, d);
                }}
                // touch-none is what stops a touch-drag scrolling the page
                // instead of moving the tile.
                className={GRIP}
              >
                <GripIcon size={16} />
              </button>
              {showPosition ? (
                <span className="tabular bg-page/90 px-1.5 py-0.5 text-[10px] text-meta">
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
