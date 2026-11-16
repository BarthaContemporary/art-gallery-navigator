import type { SupabaseClient } from "@supabase/supabase-js";
import { COL } from "../lib/columns.ts";
import type { CleanedRow } from "../lib/clean.ts";
import { chunk, selectAll } from "../lib/db.ts";
import { finalizeRefusal, purchaseYearSeries, resolveCode } from "../lib/finalize-plan.ts";
import { normalizeMakerName } from "../lib/maker.ts";

/** Purchase-year series: rows with no purchase date are numbered in this year. */
const IMPORT_YEAR = 2026;

const PIECE_STATUS_VALUES = new Set([
  "in_stock",
  "reserved",
  "consigned_in",
  "consigned_out",
  "sold",
  "gifted",
  "returned",
  "written_off",
]);

export interface FinalizeOptions {
  acceptMakers: boolean;
  purchaseYearSeries: boolean;
  batchSize: number;
  /** Finish a run that failed part-way (refused otherwise once works exist). */
  resume: boolean;
}

export interface Mapping {
  field: string;
  raw_value: string;
  mapped_kind: string | null;
  mapped_value: string | null;
  reviewed: boolean;
}

type MappingIndex = Map<string, Mapping>; // `${field}<NUL>${raw_value}`

export function mappingKey(field: string, rawValue: string): string {
  return `${field}\u0000${rawValue.trim()}`;
}

function lookup(
  index: MappingIndex,
  field: string,
  rawValue: string | null,
): Mapping | null {
  if (rawValue === null) return null;
  return index.get(mappingKey(field, rawValue)) ?? null;
}

/**
 * Finalize: cleaned.json + reviewed legacy_value_mappings -> real rows in
 * makers / pieces / piece_financials / provenance_entries / piece_images,
 * linking legacy_filemaker_rows.piece_id as each batch of works is made.
 *
 * NOT a command to re-run: once works have been imported it refuses to
 * start (a second run duplicates works and re-creates purged ones). After a
 * run that failed part-way, --resume carries on: legacy rows already linked,
 * and rows whose unique legacy stock number a work already carries, are
 * skipped. A work purged from the recycle bin since leaves no trace and
 * would come back, so --resume is for straight after the failure only.
 */
export async function runFinalize(
  db: SupabaseClient,
  cleaned: CleanedRow[],
  opts: FinalizeOptions,
): Promise<void> {
  // ------------------------------------------------------------------ setup
  const legacyRows = await selectAll<{ row_number: number; piece_id: string | null }>(
    db,
    "legacy_filemaker_rows",
    "id, row_number, piece_id",
    "id",
  );
  if (legacyRows.length === 0) {
    throw new Error("legacy_filemaker_rows is empty — run `pnpm migrate load-raw` first.");
  }
  const alreadyLinked = new Set(legacyRows.filter((r) => r.piece_id !== null).map((r) => r.row_number));

  const existingLegacy = new Set(
    (await selectAll<{ legacy_stock_number: string | null }>(db, "pieces", "id, legacy_stock_number", "id"))
      .map((p) => p.legacy_stock_number)
      .filter((s): s is string => s !== null),
  );
  const refusal = finalizeRefusal(
    { linkedRows: alreadyLinked.size, importedPieces: existingLegacy.size },
    opts.resume,
  );
  if (refusal) throw new Error(refusal);

  const mappingsData = await selectAll<Mapping>(
    db,
    "legacy_value_mappings",
    "id, field, raw_value, mapped_kind, mapped_value, reviewed",
    "id",
  );
  const mappings: MappingIndex = new Map(mappingsData.map((m) => [mappingKey(m.field, m.raw_value), m]));

  // Duplicate legacy numbers get the conflict flag.
  const legacyCounts = new Map<string, number>();
  for (const row of cleaned) {
    if (row.stock_number) {
      legacyCounts.set(row.stock_number, (legacyCounts.get(row.stock_number) ?? 0) + 1);
    }
  }
  // A row whose work exists although its legacy row lost the link (a run
  // that stopped between the two writes): known by its unique legacy number.
  const madeUnlinked = (r: CleanedRow) =>
    r.stock_number !== null && legacyCounts.get(r.stock_number) === 1 && existingLegacy.has(r.stock_number);

  const todo = cleaned.filter((r) => !alreadyLinked.has(r.row_number) && !madeUnlinked(r));
  console.log(
    `finalize: ${cleaned.length} cleaned rows, ${alreadyLinked.size} already linked, ` +
      `${cleaned.filter((r) => !alreadyLinked.has(r.row_number) && madeUnlinked(r)).length} made but unlinked, ` +
      `${todo.length} to import`,
  );
  if (todo.length === 0) return;

  // ---------------------------------------- category and storage-location codes
  const idByCode = async (table: "categories" | "locations") =>
    new Map(
      (await selectAll<{ id: string; code: string }>(db, table, "id, code", "id")).map((c) => [
        c.code.trim().toUpperCase(),
        c.id,
      ]),
    );
  const categoryIds = await idByCode("categories");
  const locationIds = await idByCode("locations");
  const unresolvedCodes = new Map<string, number>(); // "<kind> <value>" -> rows

  // ----------------------------------------------------------------- makers
  // Proposals become makers only when the dealer confirms (--accept-makers).
  const makerIdByKey = new Map<string, string>();
  for (const m of await selectAll<{ id: string; display_name: string }>(db, "makers", "id, display_name", "id")) {
    makerIdByKey.set(normalizeMakerName(m.display_name), m.id);
  }
  if (opts.acceptMakers) {
    const wanted = new Map<string, { display_name: string; life_dates: string | null }>();
    for (const row of todo) {
      if (!row.proposed_maker) continue;
      const key = normalizeMakerName(row.proposed_maker);
      if (!makerIdByKey.has(key) && !wanted.has(key)) {
        wanted.set(key, {
          display_name: row.proposed_maker,
          life_dates: row.proposed_maker_life_dates,
        });
      }
    }
    const newMakers = [...wanted.entries()];
    for (const batch of chunk(newMakers, opts.batchSize)) {
      const { data, error } = await db
        .from("makers")
        .insert(
          batch.map(([, m]) => ({
            display_name: m.display_name,
            life_dates: m.life_dates,
            notes: "Created by FileMaker migration (dealer-confirmed proposal)",
          })),
        )
        .select("id, display_name");
      if (error) throw new Error(`inserting makers: ${error.message}`);
      for (const m of data ?? []) {
        makerIdByKey.set(normalizeMakerName(m.display_name as string), m.id as string);
      }
    }
    console.log(`makers: ${newMakers.length} created, ${makerIdByKey.size} total known`);
  } else {
    console.log("makers: --accept-makers not set — maker proposals NOT applied");
  }

  // -------------------------------------------------- stock number strategy
  // Default: stock_number omitted -> DB trigger assigns current-year series.
  // --purchase-year-series: explicit YYYY-NNNN by purchase year, assigned in
  // chronological purchase order so the stock book reads chronologically.
  let explicitStockNumbers = new Map<number, string>(); // row_number -> stock number
  if (opts.purchaseYearSeries) {
    // Each year continues after the numbers already used, so a resumed run
    // (or works added in the studio meanwhile) never collides.
    const counters = new Map(
      (await selectAll<{ year: number; last_seq: number }>(db, "stock_number_counters", "year, last_seq", "year")).map(
        (c) => [c.year, c.last_seq],
      ),
    );
    const series = purchaseYearSeries(todo, counters, IMPORT_YEAR);
    explicitStockNumbers = series.numbers;
    const seqByYear = series.lastByYear;
    // Seed counters above the migrated maxima so trigger-assigned numbers
    // never collide with the migrated series.
    for (const [year, lastSeq] of seqByYear) {
      const { data: counter } = await db
        .from("stock_number_counters")
        .select("last_seq")
        .eq("year", year)
        .maybeSingle();
      const current = (counter?.last_seq as number | undefined) ?? 0;
      if (lastSeq > current) {
        const { error } = await db
          .from("stock_number_counters")
          .upsert({ year, last_seq: lastSeq }, { onConflict: "year" });
        if (error) throw new Error(`seeding stock_number_counters: ${error.message}`);
      }
    }
    console.log(
      `stock numbers: purchase-year series assigned for ${explicitStockNumbers.size} rows ` +
        `(${[...seqByYear.keys()].sort().join(", ")})`,
    );
  }

  // ------------------------------------------------------------ main batches
  let imported = 0;
  for (const batch of chunk(todo, opts.batchSize)) {
    const pieceRows = batch.map((row) => {
      const categoryMapping = lookup(mappings, "category", row.category_raw);
      const locationMapping = lookup(mappings, "location", row.location_raw);
      const statusMapping = lookup(mappings, "status", row.status_raw);
      const publishedMapping = lookup(mappings, "published", row.published_raw);

      let status = row.proposed_status as string;
      const mappedStatus =
        (statusMapping?.mapped_kind === "status" && statusMapping.mapped_value) ||
        (categoryMapping?.mapped_kind === "status" && categoryMapping.mapped_value) ||
        null;
      if (mappedStatus && PIECE_STATUS_VALUES.has(mappedStatus)) status = mappedStatus;

      const originRegion =
        (categoryMapping?.mapped_kind === "origin_region" && categoryMapping.mapped_value) ||
        (locationMapping?.mapped_kind === "origin_region" && locationMapping.mapped_value) ||
        null;

      // The reviewed category and storage-location codes (BUILD_PLAN §3).
      const category = resolveCode(categoryMapping, "category_code", categoryIds);
      const location = resolveCode(locationMapping, "storage_location", locationIds);
      for (const [kind, value] of [
        ["category", category.unresolved],
        ["location", location.unresolved],
      ] as const) {
        if (value) unresolvedCodes.set(`${kind} ${value}`, (unresolvedCodes.get(`${kind} ${value}`) ?? 0) + 1);
      }

      const piece: Record<string, unknown> = {
        legacy_stock_number: row.stock_number,
        legacy_stock_number_conflict:
          row.stock_number !== null && (legacyCounts.get(row.stock_number) ?? 0) > 1,
        title: row.title,
        medium: row.medium,
        origin_region: originRegion,
        category_id: category.id,
        location_id: location.id,
        description: row.description,
        box_type: row.box_type,
        box_notes: row.box_notes,
        height_cm: row.height_cm,
        width_cm: row.width_cm,
        depth_cm: row.depth_cm,
        length_cm: row.length_cm,
        diameter_cm: row.diameter_cm,
        dimensions_display: row.dimensions_display,
        status,
        photographer: row.photographer,
        comments: row.comments,
        web_visible:
          publishedMapping?.mapped_kind === "web_published" &&
          publishedMapping.mapped_value === "true",
      };
      if (opts.acceptMakers && row.proposed_maker) {
        piece["maker_id"] = makerIdByKey.get(normalizeMakerName(row.proposed_maker)) ?? null;
      }
      const explicit = explicitStockNumbers.get(row.row_number);
      if (explicit) piece["stock_number"] = explicit;
      return piece;
    });

    const { data: insertedPieces, error: pieceErr } = await db
      .from("pieces")
      .insert(pieceRows)
      .select("id");
    if (pieceErr) throw new Error(`inserting pieces: ${pieceErr.message}`);
    if (!insertedPieces || insertedPieces.length !== batch.length) {
      throw new Error(
        `pieces insert returned ${insertedPieces?.length ?? 0} rows for a batch of ${batch.length}`,
      );
    }

    const pieceIdByRow = new Map<number, string>();
    batch.forEach((row, i) => pieceIdByRow.set(row.row_number, insertedPieces[i]!.id as string));

    // Link the permanent raw snapshot to its created piece straight away,
    // before the financials, provenance and images: a failure after this
    // point leaves complete links, so --resume never makes these works twice.
    for (const row of batch) {
      const { error } = await db
        .from("legacy_filemaker_rows")
        .update({ piece_id: pieceIdByRow.get(row.row_number)! })
        .eq("row_number", row.row_number)
        .is("piece_id", null);
      if (error) throw new Error(`linking legacy row ${row.row_number}: ${error.message}`);
    }

    // piece_financials — a DB trigger auto-creates a row per piece, so upsert.
    const financialRows = batch.map((row) => {
      const pieceId = pieceIdByRow.get(row.row_number)!;
      const vatStandard = row.vat_yes?.trim().toUpperCase() === "Y";
      return {
        piece_id: pieceId,
        purchase_date: row.purchase_date,
        purchase_cost: row.purchase_cost,
        purchase_currency: row.purchase_currency ?? "GBP",
        purchase_fx: row.purchase_fx ?? 1,
        purchase_cost_gbp: row.purchase_cost_gbp,
        restoration_cost_gbp: row.restoration_cost ?? 0,
        other_costs_gbp: row.other_cost ?? 0,
        marked_price_gbp: row.marked_price,
        sold_price: row.sold_price,
        sell_currency: row.sell_currency ?? "GBP",
        sell_fx: row.sell_fx ?? 1,
        sold_price_gbp: row.sold_price_gbp,
        vat_treatment: vatStandard ? "standard" : "margin_scheme",
        vat_review_needed: !vatStandard,
      };
    });
    const { error: finErr } = await db
      .from("piece_financials")
      .upsert(financialRows, { onConflict: "piece_id" });
    if (finErr) throw new Error(`upserting piece_financials: ${finErr.message}`);

    // provenance_entries from buyer_note mappings on the Published column.
    const provenanceRows = batch.flatMap((row) => {
      const publishedMapping = lookup(mappings, "published", row.published_raw);
      if (publishedMapping?.mapped_kind !== "buyer_note") return [];
      const note = publishedMapping.mapped_value ?? row.published_raw!;
      const year = note.match(/\((\d{4})\)/)?.[1] ?? null;
      return [
        {
          piece_id: pieceIdByRow.get(row.row_number)!,
          sort_order: 0,
          date_text: year,
          party: note.replace(/\s*\(\d{4}\)\s*/g, " ").replace(/\s+/g, " ").trim(),
          event_type: "acquired",
          details: `Buyer/export note from legacy 'Published' column: "${row.published_raw}"`,
          is_public: false,
        },
      ];
    });
    if (provenanceRows.length > 0) {
      const { error } = await db.from("provenance_entries").insert(provenanceRows);
      if (error) throw new Error(`inserting provenance_entries: ${error.message}`);
    }

    // piece_images stubs — Container1 is the front shot, the rest details.
    const imageRows = batch.flatMap((row) =>
      row.containers.map((c, i) => ({
        piece_id: pieceIdByRow.get(row.row_number)!,
        role: c.column === COL.container1 ? "front" : "detail",
        sort_order: i,
        legacy_container_filename: c.filename,
        processing_status: "pending",
      })),
    );
    if (imageRows.length > 0) {
      const { error } = await db.from("piece_images").insert(imageRows);
      if (error) throw new Error(`inserting piece_images: ${error.message}`);
    }

    imported += batch.length;
    console.log(`finalize: ${imported}/${todo.length} rows imported`);
  }

  if (unresolvedCodes.size > 0) {
    console.log("finalize: mapped codes that match no category or storage location (left empty):");
    for (const [what, n] of [...unresolvedCodes].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(5)}  ${what}`);
    }
  }
  console.log("finalize: done");
}
