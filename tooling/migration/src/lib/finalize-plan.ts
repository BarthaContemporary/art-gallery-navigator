/**
 * Pure decisions for `finalize` and `backfill-codes` (no I/O, so
 * `node --test` covers them): whether a run may start, the purchase-year
 * stock numbers, and the category / storage-location codes the dealer
 * mapped, for new works and for the works an earlier import made.
 */

export interface FinalizeState {
  /** legacy_filemaker_rows already linked to a piece. */
  linkedRows: number;
  /** pieces carrying a legacy_stock_number (made by an earlier import). */
  importedPieces: number;
}

/**
 * finalize creates works. Once an import has run, a second full run
 * duplicates works (rows whose link was lost) and re-creates works purged
 * from the recycle bin (their legacy row's link is cleared on delete). So a
 * database that already holds imported works is refused unless the operator
 * says --resume, which is only for finishing a run that failed part-way.
 */
export function finalizeRefusal(state: FinalizeState, resume: boolean): string | null {
  if (resume) return null;
  if (state.linkedRows === 0 && state.importedPieces === 0) return null;
  return [
    `This database already holds an import: ${state.linkedRows} legacy rows are linked to works ` +
      `and ${state.importedPieces} works carry a legacy stock number.`,
    "Running finalize again would create duplicates, and bring back works deleted since.",
    "Only to finish a run that stopped part-way, run it again with --resume.",
  ].join("\n");
}

/**
 * --purchase-year-series: YYYY-NNNN by purchase year in chronological
 * purchase order, each year continuing after the highest number already
 * used (stock_number_counters), so a resumed run or works made in the
 * studio meanwhile never collide. Rows without a purchase date go in
 * `fallbackYear`.
 */
export function purchaseYearSeries(
  rows: ReadonlyArray<{ row_number: number; purchase_date: string | null }>,
  lastSeqByYear: ReadonlyMap<number, number>,
  fallbackYear: number,
): { numbers: Map<number, string>; lastByYear: Map<number, number> } {
  const ordered = [...rows].sort((a, b) =>
    (a.purchase_date ?? "9999-99-99").localeCompare(b.purchase_date ?? "9999-99-99"),
  );
  const lastByYear = new Map<number, number>();
  const numbers = new Map<number, string>();
  for (const row of ordered) {
    const year = row.purchase_date ? Number(row.purchase_date.slice(0, 4)) : fallbackYear;
    const seq = (lastByYear.get(year) ?? lastSeqByYear.get(year) ?? 0) + 1;
    lastByYear.set(year, seq);
    numbers.set(row.row_number, `${year}-${String(seq).padStart(4, "0")}`);
  }
  return { numbers, lastByYear };
}

export interface CodeMapping {
  mapped_kind: string | null;
  mapped_value: string | null;
}

/**
 * The id a reviewed mapping points at: `kind` ('category_code' or
 * 'storage_location') whose value is a code in `idByCode` (categories.code /
 * locations.code, compared without case). A value that names no code is
 * returned as `unresolved`, to report, never guessed.
 */
export function resolveCode(
  mapping: CodeMapping | null,
  kind: "category_code" | "storage_location",
  idByCode: ReadonlyMap<string, string>,
): { id: string | null; unresolved: string | null } {
  if (!mapping || mapping.mapped_kind !== kind || !mapping.mapped_value?.trim()) {
    return { id: null, unresolved: null };
  }
  const code = mapping.mapped_value.trim().toUpperCase();
  const id = idByCode.get(code) ?? null;
  return { id, unresolved: id ? null : mapping.mapped_value.trim() };
}

/** The mapping kinds a reviewed CSV may use (cli import-mappings checks). */
export const MAPPING_KINDS = [
  "status",
  "origin_region",
  "category_code",
  "storage_location",
  "web_published",
  "buyer_note",
  "unknown",
] as const;

/** A legacy row already linked to its work, with its raw category and location. */
export interface LinkedLegacyRow {
  piece_id: string;
  category_raw: string | null;
  location_raw: string | null;
}

export type CodeColumn = "category_id" | "location_id";

export interface CodeBackfillPlan {
  /** Per column: target id -> the works to set (only works still empty there). */
  updates: Record<CodeColumn, Map<string, string[]>>;
  /** Works that already carry a value there: kept, whatever the legacy row says. */
  kept: Record<CodeColumn, number>;
  /** Mapped values naming no code, for works still empty: "<field> <value>" -> works. */
  unresolved: Map<string, number>;
  /** Works whose legacy rows map to two different codes: left empty, listed. */
  conflicts: Record<CodeColumn, string[]>;
}

const CODE_FIELDS = [
  { field: "category", kind: "category_code", column: "category_id", raw: (r: LinkedLegacyRow) => r.category_raw },
  { field: "location", kind: "storage_location", column: "location_id", raw: (r: LinkedLegacyRow) => r.location_raw },
] as const;

/**
 * backfill-codes: the category and storage location the first import should
 * have given its works (finalize did not apply those mappings then). Only a
 * work whose column is still empty is set, so anything a person chose since
 * is kept; a mapped value that names no code is reported, never guessed.
 */
export function planCodeBackfill(
  rows: readonly LinkedLegacyRow[],
  pieces: ReadonlyMap<string, { category_id: string | null; location_id: string | null }>,
  mappingFor: (field: "category" | "location", rawValue: string | null) => CodeMapping | null,
  idsByCode: { category: ReadonlyMap<string, string>; location: ReadonlyMap<string, string> },
): CodeBackfillPlan {
  const plan: CodeBackfillPlan = {
    updates: { category_id: new Map(), location_id: new Map() },
    kept: { category_id: 0, location_id: 0 },
    unresolved: new Map(),
    conflicts: { category_id: [], location_id: [] },
  };
  const wanted: Record<CodeColumn, Map<string, Set<string>>> = { category_id: new Map(), location_id: new Map() };
  const keptWorks: Record<CodeColumn, Set<string>> = { category_id: new Set(), location_id: new Set() };
  for (const row of rows) {
    const piece = pieces.get(row.piece_id);
    if (!piece) continue; // the work is gone
    for (const f of CODE_FIELDS) {
      const { id, unresolved } = resolveCode(mappingFor(f.field, f.raw(row)), f.kind, idsByCode[f.field]);
      if (piece[f.column] !== null) {
        if (id) keptWorks[f.column].add(row.piece_id);
        continue;
      }
      if (unresolved) {
        const key = `${f.field} ${unresolved}`;
        plan.unresolved.set(key, (plan.unresolved.get(key) ?? 0) + 1);
      }
      if (!id) continue;
      const ids = wanted[f.column].get(row.piece_id) ?? new Set<string>();
      ids.add(id);
      wanted[f.column].set(row.piece_id, ids);
    }
  }
  for (const column of ["category_id", "location_id"] as const) {
    plan.kept[column] = keptWorks[column].size;
    for (const [pieceId, ids] of wanted[column]) {
      if (ids.size > 1) {
        plan.conflicts[column].push(pieceId);
        continue;
      }
      const [id] = [...ids] as [string];
      const list = plan.updates[column].get(id) ?? [];
      list.push(pieceId);
      plan.updates[column].set(id, list);
    }
  }
  return plan;
}
