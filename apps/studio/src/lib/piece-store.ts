import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/chunk";

/*
 * Which stock table holds a given work.
 *
 * A work lives in exactly one of two sibling tables — `pieces` (JvdB stock) or
 * `external_pieces` (held and handled like stock, but not JvdB's property) —
 * under a UUID that belongs to it for its whole life, in `piece_ref`. Lists,
 * search and exports read the union (`vw_pieces_list`, `pieces_search`) and
 * never need this. Anything that reads or writes *one* record does: it has a
 * stock number and needs the table that goes with it.
 *
 * Keeping that lookup in one place is the point. The same logic drifting across
 * twenty route handlers is exactly how the live-list bug happened.
 */

export type Ledger = "jvb" | "external";

export type PieceRef = {
  id: string;
  stockNumber: string;
  ledger: Ledger;
  /** The table to read and write this record through. */
  table: "pieces" | "external_pieces";
  /**
   * Set when the caller asked for a number the record used to carry. Callers
   * that render a URL should redirect to `stockNumber`.
   */
  retiredNumber?: string;
};

export const LEDGER_TABLE: Record<Ledger, PieceRef["table"]> = {
  jvb: "pieces",
  external: "external_pieces",
};

export const LEDGER_LABEL: Record<Ledger, string> = {
  jvb: "JvdB stock",
  external: "Not JvdB",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

function refFrom(row: { id: string; stock_number: string; ledger: Ledger }): PieceRef {
  return {
    id: row.id,
    stockNumber: row.stock_number,
    ledger: row.ledger,
    table: LEDGER_TABLE[row.ledger],
  };
}

/**
 * Resolve a stock number to the record it names, in whichever register holds
 * it. Falls back to the move log, so a number that was retired when a work
 * changed register still resolves — it is on labels, in sent PDFs and in old
 * emails, and dead-ending on it would be worse than a redirect.
 */
export async function resolvePiece(supabase: Db, stockNumber: string): Promise<PieceRef | null> {
  const { data } = await supabase
    .from("vw_pieces_list")
    .select("id, stock_number, ledger")
    .eq("stock_number", stockNumber)
    .maybeSingle();
  if (data) return refFrom(data as { id: string; stock_number: string; ledger: Ledger });

  const { data: moved } = await supabase
    .from("piece_ledger_moves")
    .select("piece_id, to_stock_number")
    .eq("from_stock_number", stockNumber)
    .order("moved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!moved) return null;

  const current = await resolvePieceById(supabase, (moved as { piece_id: string }).piece_id);
  return current ? { ...current, retiredNumber: stockNumber } : null;
}

/** Resolve by the stable identity UUID — the id never changes across a move. */
export async function resolvePieceById(supabase: Db, id: string): Promise<PieceRef | null> {
  const { data } = await supabase
    .from("vw_pieces_list")
    .select("id, stock_number, ledger")
    .eq("id", id)
    .maybeSingle();
  return data ? refFrom(data as { id: string; stock_number: string; ledger: Ledger }) : null;
}

/**
 * Resolve many ids at once, for surfaces that act on a selection (bulk update,
 * offers, list exports) and must write each row to the right table.
 */
export async function resolvePieces(supabase: Db, ids: string[]): Promise<Map<string, PieceRef>> {
  const out = new Map<string, PieceRef>();
  if (ids.length === 0) return out;
  const rows = await selectInChunks<{ id: string; stock_number: string; ledger: Ledger }>(
    ids,
    (chunk) =>
      supabase.from("vw_pieces_list").select("id, stock_number, ledger").in("id", chunk),
  );
  for (const row of rows) out.set(row.id, refFrom(row));
  return out;
}

/**
 * The columns a satellite row needs when it shows the work it is attached to.
 *
 * These used to come from a PostgREST embed (`piece:pieces ( … )`). Satellites
 * now key on `piece_ref`, so there is no foreign key from a satellite to either
 * stock table for PostgREST to follow — fetch the ids, then look the works up in
 * the union view. Same two-step the list exports already use.
 */
export type PieceSummary = {
  id: string;
  stock_number: string;
  title: string | null;
  medium: string | null;
  period: string | null;
  status: string;
  year: string | null;
  ledger: Ledger;
};

const SUMMARY_COLUMNS = "id, stock_number, title, medium, period, status, year, ledger";

/**
 * Load whichever columns a caller needs for a set of works, from either
 * register, keyed by id. `vw_pieces_all` carries every piece column plus the
 * maker, category and location fields that used to arrive via nested embeds.
 */
export async function loadPieceRows<T extends { id: string }>(
  supabase: Db,
  ids: string[],
  columns: string,
): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  if (ids.length === 0) return out;
  // Chunked: a single .in() with a few hundred ids exceeds the URL limit and
  // comes back 414, which used to surface as a silently empty list.
  const rows = await selectInChunks<T>(ids, (chunk) =>
    supabase.from("vw_pieces_all").select(columns).in("id", chunk) as unknown as PromiseLike<{
      data: T[] | null;
      error: { message: string } | null;
    }>,
  );
  for (const row of rows) out.set(row.id, row);
  return out;
}

export async function loadPieceSummaries(
  supabase: Db,
  ids: string[],
): Promise<Map<string, PieceSummary>> {
  return loadPieceRows<PieceSummary>(supabase, ids, SUMMARY_COLUMNS);
}

/** Group ids by the table they must be written through. */
export function byTable(refs: Iterable<PieceRef>): Record<PieceRef["table"], string[]> {
  const out: Record<PieceRef["table"], string[]> = { pieces: [], external_pieces: [] };
  for (const r of refs) out[r.table].push(r.id);
  return out;
}
