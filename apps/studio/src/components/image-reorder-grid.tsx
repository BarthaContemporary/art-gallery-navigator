"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Drag-to-reorder for the image grid.
 *
 * Built on Pointer Events rather than HTML5 drag-and-drop, because dragstart
 * never fires on iOS or Android — and this grid gets used on an iPad while
 * photographing stock at a fair. One code path covers mouse, trackpad and touch.
 *
 * Dragging is by a grip handle, not the whole tile. Each tile carries a rotate
 * button, a caption field and a delete button; making the tile itself draggable
 * would mean guessing whether a press was a drag or a tap on one of those, and
 * guessing wrong either eats a click or starts a drag nobody asked for.
 *
 * The tiles are rendered on the server and handed over as nodes keyed by id.
 * This component owns nothing but their order, so every per-image control keeps
 * working exactly as it did.
 */

export function ImageReorderGrid({
  order: serverOrder,
  tiles,
  onReorder,
}: {
  /** Image ids in their persisted order. */
  order: string[];
  /** Server-rendered tile per image id. */
  tiles: Record<string, React.ReactNode>;
  /** Persists a new order. Called once, on drop. */
  onReorder: (ids: string[]) => Promise<void>;
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

  const cellRefs = useRef(new Map<string, HTMLLIElement>());
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
   * Keyboard equivalent, on the handle. A drag has none, and the arrow buttons
   * this replaces were reachable by tab — losing that to gain a nicer gesture
   * would be a poor trade.
   */
  async function onHandleKeyDown(id: string, e: React.KeyboardEvent) {
    const delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, ...next.splice(from, 1));
    const before = order;
    setOrder(next);
    await persist(next, before);
  }

  return (
    <>
      <p className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
        <span>Drag a grip to reorder. The first image is the one used as the thumbnail.</span>
        <span aria-live="polite" className={saving ? "text-ink-muted" : "sr-only"}>
          {saving ? "Saving order…" : ""}
        </span>
      </p>

      <ul className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {order.map((id, i) => (
          <li
            key={id}
            ref={(el) => {
              if (el) cellRefs.current.set(id, el);
              else cellRefs.current.delete(id);
            }}
            className={`relative rounded-[9px] ${dragId === id ? "z-10 opacity-60" : ""}`}
          >
            <span className="absolute left-2 top-2 z-20 flex items-center gap-1">
              <button
                type="button"
                aria-label={`Reorder image ${i + 1} of ${order.length}`}
                title="Drag to reorder — or focus and use ← →"
                onPointerDown={() => startDrag(id)}
                onKeyDown={(e) => void onHandleKeyDown(id, e)}
                // touch-none is what stops a touch-drag scrolling the page
                // instead of moving the tile.
                className="min-h-[28px] cursor-grab touch-none rounded-md border border-line-control bg-cell/90 px-1.5 text-[13px] leading-none text-ink-soft active:cursor-grabbing"
              >
                ⠿
              </button>
              <span className="rounded-md bg-cell/90 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">
                {i + 1}
              </span>
            </span>
            {tiles[id]}
          </li>
        ))}
      </ul>
    </>
  );
}
