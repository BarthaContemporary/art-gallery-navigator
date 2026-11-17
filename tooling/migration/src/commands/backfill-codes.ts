import type { SupabaseClient } from "@supabase/supabase-js";
import { COL } from "../lib/columns.ts";
import { chunk, selectAll } from "../lib/db.ts";
import { planCodeBackfill, type CodeColumn, type LinkedLegacyRow } from "../lib/finalize-plan.ts";
import { toText } from "../lib/values.ts";
import { mappingKey, type Mapping } from "./finalize.ts";

export interface BackfillCodesOptions {
  /** Write the changes; without it the command only reports (dry run). */
  apply: boolean;
}

/**
 * backfill-codes: give the works the first import made the category and
 * storage location their FileMaker row maps to (legacy_filemaker_rows.raw
 * 'Category' / 'Location' -> the reviewed legacy_value_mappings ->
 * categories.code / locations.code). finalize did not apply those two
 * mappings when the live import ran, so imported works have none.
 *
 * Only empty columns are filled: a category or location a person set since
 * is kept. A mapped value that names no code (for example a location 'SJ'
 * when the code is 'ST-JAMES') is listed and left empty; correct the
 * mapping (location.csv / category.csv and import-mappings, or the row in
 * legacy_value_mappings) and run again. Safe to run again: a second run
 * finds those works filled and skips them.
 *
 * Writing a location records a move (null -> the location) in the work's
 * location history, and every change goes in the activity log and queues a
 * website sync for works shown there (nothing on the website shows these
 * two fields).
 */
const works = (n: number) => `${n} ${n === 1 ? "work" : "works"}`;

export async function runBackfillCodes(db: SupabaseClient, opts: BackfillCodesOptions): Promise<void> {
  const legacy = await selectAll<{ id: string; piece_id: string | null; raw: Record<string, unknown> | null }>(
    db,
    "legacy_filemaker_rows",
    "id, piece_id, raw",
    "id",
  );
  const linked: LinkedLegacyRow[] = legacy
    .filter((r): r is typeof r & { piece_id: string } => r.piece_id !== null)
    .map((r) => ({
      piece_id: r.piece_id,
      category_raw: toText(r.raw?.[COL.category]),
      location_raw: toText(r.raw?.[COL.location]),
    }));
  console.log(`backfill-codes: ${legacy.length} legacy rows, ${linked.length} linked to a work`);
  if (linked.length === 0) return;

  const mappingsData = await selectAll<Mapping>(
    db,
    "legacy_value_mappings",
    "id, field, raw_value, mapped_kind, mapped_value, reviewed",
    "id",
  );
  const mappings = new Map(mappingsData.map((m) => [mappingKey(m.field, m.raw_value), m]));
  const mappingFor = (field: string, rawValue: string | null) =>
    rawValue === null ? null : (mappings.get(mappingKey(field, rawValue)) ?? null);

  const pieces = new Map(
    (
      await selectAll<{ id: string; category_id: string | null; location_id: string | null }>(
        db,
        "pieces",
        "id, category_id, location_id",
        "id",
      )
    ).map((p) => [p.id, p]),
  );
  const codes = async (table: "categories" | "locations") => {
    const rows = await selectAll<{ id: string; code: string }>(db, table, "id, code", "id");
    return {
      idByCode: new Map(rows.map((c) => [c.code.trim().toUpperCase(), c.id])),
      codeById: new Map(rows.map((c) => [c.id, c.code])),
    };
  };
  const categories = await codes("categories");
  const locations = await codes("locations");

  const plan = planCodeBackfill(linked, pieces, mappingFor, {
    category: categories.idByCode,
    location: locations.idByCode,
  });

  const columns: Array<{ column: CodeColumn; label: string; codeById: Map<string, string> }> = [
    { column: "category_id", label: "category", codeById: categories.codeById },
    { column: "location_id", label: "storage location", codeById: locations.codeById },
  ];
  for (const { column, label, codeById } of columns) {
    const total = [...plan.updates[column].values()].reduce((n, ids) => n + ids.length, 0);
    console.log(`\n${label}: ${works(total)} to set, ${works(plan.kept[column])} already set (kept)`);
    for (const [id, ids] of [...plan.updates[column]].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${String(ids.length).padStart(5)}  ${codeById.get(id) ?? id}`);
    }
    if (plan.conflicts[column].length > 0) {
      console.log(`  ${works(plan.conflicts[column].length)} left empty: their legacy rows map to different codes`);
      for (const id of plan.conflicts[column]) console.log(`         ${id}`);
    }
  }
  if (plan.unresolved.size > 0) {
    console.log("\nmapped values that match no category or storage location code (left empty):");
    for (const [what, n] of [...plan.unresolved].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${what}`);
    }
  }

  if (!opts.apply) {
    console.log("\nDry run: nothing written. Run again with --apply to write the changes above.");
    return;
  }
  for (const { column, label } of columns) {
    let written = 0;
    for (const [id, ids] of plan.updates[column]) {
      for (const batch of chunk(ids, 100)) {
        // .is(column, null): a work someone filled in meanwhile is kept.
        const { data, error } = await db
          .from("pieces")
          .update({ [column]: id })
          .in("id", batch)
          .is(column, null)
          .select("id");
        if (error) throw new Error(`setting ${label}: ${error.message} (${written} written so far; run again to finish)`);
        written += data?.length ?? 0;
      }
    }
    console.log(`backfill-codes: ${label} set on ${works(written)}`);
  }
}
