/*
 * The order arithmetic of ReorderGrid (components/reorder-grid.tsx), kept
 * pure so the component computes the next order once, outside any React
 * state updater (an updater may run twice, and the save must not), and so
 * it can be tested on its own (order-move.test.ts).
 */

/** `id` moved `delta` places (−1 back, +1 forward); the same array when it cannot move. */
export function moveBy(order: readonly string[], id: string, delta: number): readonly string[] {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || delta === 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** `id` moved into the place of `overId` (a drag over another item); the same array when either is missing. */
export function moveOver(order: readonly string[], id: string, overId: string): readonly string[] {
  if (id === overId) return order;
  const from = order.indexOf(id);
  const to = order.indexOf(overId);
  if (from < 0 || to < 0) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** The arrow keys a grip answers: back for Left/Up, forward for Right/Down, 0 for any other key. */
export function arrowDelta(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft" || key === "ArrowUp") return -1;
  if (key === "ArrowRight" || key === "ArrowDown") return 1;
  return 0;
}

export const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);
