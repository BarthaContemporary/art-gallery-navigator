/**
 * Which photograph leads a work: the 'front' shot if there is one, then the
 * lowest sort order, then the oldest. The same rule as
 * vw_pieces_list.primary_image_id (`order by (role <> 'front'), sort_order,
 * created_at`), lib/thumbnails.ts and the fact sheets, so a work shows the
 * same picture in an export as on the screen and on the website's offer
 * page. Picking by sort order alone let a label or back shot taken first
 * (the capture app numbers photographs in the order they were taken) lead.
 *
 * A photograph the image worker could not process (processing_status
 * 'error') never leads. Callers may also leave out roles: the client-facing
 * offer presentation leaves out 'document' (the capture app's label shot:
 * labels, tickets, lot slips), which never leave the studio.
 *
 * Self-contained on purpose (no imports): node --test runs it directly.
 */

export type LeadImageCandidate = {
  piece_id: string;
  role?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  processing_status?: string | null;
};

/** Negative when `a` should lead before `b`. */
export function compareLeadImages(a: LeadImageCandidate, b: LeadImageCandidate): number {
  const front = (a.role === "front" ? 0 : 1) - (b.role === "front" ? 0 : 1);
  if (front !== 0) return front;
  const sort = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (sort !== 0) return sort;
  const ac = a.created_at ?? "";
  const bc = b.created_at ?? "";
  return ac < bc ? -1 : ac > bc ? 1 : 0;
}

/**
 * The leading photograph of each work among `rows`, keyed by piece id.
 * `usable` is the caller's own test (a storage path it may read, say); a row
 * it refuses is passed over as if it were not there.
 */
export function pickLeadImages<T extends LeadImageCandidate>(
  rows: readonly T[],
  options: { usable?: (row: T) => boolean; excludeRoles?: readonly string[] } = {},
): Map<string, T> {
  const exclude = new Set(options.excludeRoles ?? []);
  const best = new Map<string, T>();
  for (const row of rows) {
    if (!row.piece_id) continue;
    if (row.processing_status === "error") continue;
    if (row.role && exclude.has(row.role)) continue;
    if (options.usable && !options.usable(row)) continue;
    const current = best.get(row.piece_id);
    if (!current || compareLeadImages(row, current) < 0) best.set(row.piece_id, row);
  }
  return best;
}
