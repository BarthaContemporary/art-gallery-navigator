/**
 * Reinstate on a work's change history: which fields of one logged change
 * can be written back, shared by the record page's revertChange action
 * (what it writes) and ChangeHistory (whether it offers the button at all),
 * so the button is never shown for a change that has nothing left to put
 * back.
 *
 * Pure (no imports), so `node --test` runs it directly.
 */

/**
 * Never written back: generated, bookkeeping and identity columns, and the
 * register (a check constraint pins each stock table to its own; a register
 * move is undone with Move register, which also restores the old stock
 * number).
 */
export const NOT_REINSTATED: ReadonlySet<string> = new Set([
  "id",
  "piece_id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "search_vector",
  "total_cost_gbp",
  "margin_gbp",
  "margin_pct",
  "stock_number",
  "deleted_at",
  "ledger",
]);

/** The log's entity types (table names) a Reinstate writes through. */
export const REINSTATABLE_ENTITIES: ReadonlySet<string> = new Set(["pieces", "external_pieces", "piece_financials"]);

/**
 * The columns and prior values one logged UPDATE would write back: every
 * changed key that carries an `old` value, less the ones never written.
 */
export function reinstatePatch(changes: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (!changes || typeof changes !== "object") return patch;
  for (const [k, v] of Object.entries(changes)) {
    if (k === "old" || k === "new" || NOT_REINSTATED.has(k)) continue;
    if (v && typeof v === "object" && "old" in v) patch[k] = (v as { old?: unknown }).old ?? null;
  }
  return patch;
}

/** Whether a history entry has anything Reinstate could write back. */
export function canReinstate(entry: {
  action: string;
  entityType: string | null;
  changes: Record<string, unknown> | null;
}): boolean {
  return (
    entry.action === "UPDATE" &&
    entry.entityType != null &&
    REINSTATABLE_ENTITIES.has(entry.entityType) &&
    Object.keys(reinstatePatch(entry.changes)).length > 0
  );
}
