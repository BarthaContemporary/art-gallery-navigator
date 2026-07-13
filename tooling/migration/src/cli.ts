#!/usr/bin/env tsx
/**
 * FileMaker -> Supabase migration CLI (staged, idempotent, auditable).
 *
 * Offline commands (no DB, write to out/):
 *   parse, gen-mappings, clean, scan-images, match-images, report
 * DB commands (need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   load-raw, import-mappings, finalize
 */
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { z } from "zod";

import { COL, CONTAINER_COLUMNS, type RawRow } from "./lib/columns.js";
import { cleanRows, issueCounts, type CleanedRow, type CleanIssue } from "./lib/clean.js";
import { chunk, getSupabase } from "./lib/db.js";
import {
  CLEANED_JSON,
  DEFAULT_XLSX,
  ISSUES_CSV,
  MANIFEST_CSV,
  MAPPINGS_DIR,
  MATCHES_CSV,
  OUT_DIR,
  RAW_JSON,
  REPORT_MD,
  ensureDir,
  readCsv,
  readJson,
  readRawRows,
  writeCsv,
  writeJson,
} from "./lib/io.js";
import { matchFilename, scanImages, type ManifestEntry } from "./lib/images.js";
import {
  proposeCategory,
  proposeLocation,
  proposePublished,
  proposeStatus,
  type MappingProposal,
} from "./lib/mappings.js";
import { stockStats } from "./lib/stock.js";
import { toText } from "./lib/values.js";
import { fillRates, readWorkbook } from "./lib/xlsx.js";
import { runFinalize } from "./commands/finalize.js";

const program = new Command();
program
  .name("migrate")
  .description("FileMaker -> Supabase migration CLI (staged, idempotent, auditable)");

// ---------------------------------------------------------------------------
// parse (offline)
// ---------------------------------------------------------------------------
program
  .command("parse")
  .description("Read the FileMaker xlsx into out/raw.json and print column fill rates")
  .option("-f, --file <path>", "path to the xlsx export", DEFAULT_XLSX)
  .action(async (opts: { file: string }) => {
    if (!fs.existsSync(opts.file)) {
      console.error(`Spreadsheet not found: ${opts.file}`);
      console.error("Place the FileMaker export in tooling/migration/data/ (gitignored).");
      process.exit(1);
    }
    const { headers, rows } = await readWorkbook(opts.file);
    writeJson(RAW_JSON, rows);
    console.log(`Parsed ${rows.length} rows x ${headers.length} columns -> ${RAW_JSON}\n`);
    console.log("Column fill rates:");
    for (const { column, filled, rate } of fillRates(headers, rows)) {
      const pct = (rate * 100).toFixed(1).padStart(5);
      console.log(`  ${pct}%  ${String(filled).padStart(4)}/${rows.length}  ${column}`);
    }
  });

// ---------------------------------------------------------------------------
// gen-mappings (offline)
// ---------------------------------------------------------------------------
program
  .command("gen-mappings")
  .description("Generate dealer-review mapping CSVs (category/location/status/published)")
  .action(() => {
    const rows = readRawRows();
    const plans: Array<{
      file: string;
      column: string;
      propose: (raw: string) => MappingProposal;
    }> = [
      { file: "category.csv", column: COL.category, propose: proposeCategory },
      { file: "location.csv", column: COL.location, propose: proposeLocation },
      { file: "status.csv", column: COL.status, propose: proposeStatus },
      { file: "published.csv", column: COL.published, propose: proposePublished },
    ];
    ensureDir(MAPPINGS_DIR);
    for (const plan of plans) {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const v = toText(row.data[plan.column]);
        if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const csvRows = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([raw_value, count]) => {
          const p = plan.propose(raw_value);
          return {
            raw_value,
            count,
            proposed_kind: p.proposed_kind,
            proposed_value: p.proposed_value,
            notes: p.notes,
          };
        });
      const filePath = path.join(MAPPINGS_DIR, plan.file);
      writeCsv(filePath, csvRows, [
        "raw_value",
        "count",
        "proposed_kind",
        "proposed_value",
        "notes",
      ]);
      const unknown = csvRows.filter((r) => r.proposed_kind === "unknown").length;
      console.log(
        `${plan.file.padEnd(14)} ${String(csvRows.length).padStart(3)} distinct values ` +
          `(${unknown} unknown) -> ${filePath}`,
      );
    }
    console.log(
      "\nDealer reviews these CSVs (edit proposed_kind/proposed_value in place), " +
        "then run `pnpm migrate import-mappings --dir <reviewed-dir>`.",
    );
  });

// ---------------------------------------------------------------------------
// clean (offline)
// ---------------------------------------------------------------------------
program
  .command("clean")
  .description("Run all cleaning passes -> out/cleaned.json + out/issues.csv")
  .action(() => {
    const raw = readRawRows();
    const { rows, issues } = cleanRows(raw);
    writeJson(CLEANED_JSON, rows);
    writeCsv(
      ISSUES_CSV,
      issues.map((i) => ({ ...i })),
      ["row_number", "field", "issue", "raw_value"],
    );
    console.log(`Cleaned ${rows.length} rows -> ${CLEANED_JSON}`);
    console.log(`${issues.length} issues -> ${ISSUES_CSV}\n`);
    console.log("Issues by type:");
    for (const [issue, count] of issueCounts(issues)) {
      console.log(`  ${String(count).padStart(5)}  ${issue}`);
    }
    const withDims = rows.filter(
      (r) =>
        r.height_cm !== null ||
        r.width_cm !== null ||
        r.depth_cm !== null ||
        r.length_cm !== null ||
        r.diameter_cm !== null,
    ).length;
    const withMaker = rows.filter((r) => r.proposed_maker !== null).length;
    const sold = rows.filter((r) => r.proposed_status === "sold").length;
    console.log(
      `\nCoverage: ${withDims}/${rows.length} rows with >=1 parsed dimension, ` +
        `${withMaker} maker proposals, ${sold} proposed sold / ${rows.length - sold} in_stock`,
    );
  });

// ---------------------------------------------------------------------------
// load-raw (DB)
// ---------------------------------------------------------------------------
program
  .command("load-raw")
  .description("Upsert all raw rows into legacy_filemaker_rows (permanent snapshot)")
  .option("--batch <name>", "import batch label", `xlsx-${new Date().toISOString().slice(0, 10)}`)
  .action(async (opts: { batch: string }) => {
    const rows = readRawRows();
    const db = getSupabase();
    let done = 0;
    for (const batch of chunk(rows, 100)) {
      const { error } = await db.from("legacy_filemaker_rows").upsert(
        batch.map((r) => ({
          row_number: r.row_number,
          raw: r.data,
          import_batch: opts.batch,
        })),
        { onConflict: "row_number" },
      );
      if (error) {
        console.error(`load-raw failed at row ~${done}: ${error.message}`);
        process.exit(1);
      }
      done += batch.length;
      console.log(`load-raw: ${done}/${rows.length}`);
    }
    console.log(`Loaded ${done} rows (batch '${opts.batch}').`);
  });

// ---------------------------------------------------------------------------
// import-mappings (DB)
// ---------------------------------------------------------------------------
const reviewedCsvSchema = z.object({
  raw_value: z.string().min(1),
  count: z.string().optional(),
  proposed_kind: z.string(),
  proposed_value: z.string(),
  notes: z.string().optional(),
});

program
  .command("import-mappings")
  .description("Import dealer-reviewed mapping CSVs into legacy_value_mappings")
  .requiredOption("--dir <path>", "directory containing reviewed category/location/status/published CSVs")
  .action(async (opts: { dir: string }) => {
    const db = getSupabase();
    const files: Array<{ file: string; field: string }> = [
      { file: "category.csv", field: "category" },
      { file: "location.csv", field: "location" },
      { file: "status.csv", field: "status" },
      { file: "published.csv", field: "published" },
    ];
    let total = 0;
    for (const { file, field } of files) {
      const filePath = path.join(opts.dir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`skip ${field}: ${filePath} not found`);
        continue;
      }
      const parsed = readCsv<Record<string, string>>(filePath).map((row, i) => {
        const result = reviewedCsvSchema.safeParse(row);
        if (!result.success) {
          throw new Error(`${filePath} row ${i + 2}: ${result.error.issues[0]?.message}`);
        }
        return result.data;
      });
      for (const batch of chunk(parsed, 100)) {
        const { error } = await db.from("legacy_value_mappings").upsert(
          batch.map((r) => ({
            field,
            raw_value: r.raw_value,
            mapped_kind: r.proposed_kind,
            mapped_value: r.proposed_value,
            notes: r.notes ?? null,
            reviewed: true,
          })),
          { onConflict: "field,raw_value" },
        );
        if (error) {
          console.error(`import-mappings (${field}) failed: ${error.message}`);
          process.exit(1);
        }
      }
      total += parsed.length;
      console.log(`${field}: ${parsed.length} mappings imported`);
    }
    console.log(`Imported ${total} mappings.`);
  });

// ---------------------------------------------------------------------------
// finalize (DB)
// ---------------------------------------------------------------------------
program
  .command("finalize")
  .description(
    "Create makers/pieces/financials/provenance/image stubs from cleaned.json + reviewed mappings",
  )
  .option("--accept-makers", "treat maker proposals as dealer-confirmed and create makers", false)
  .option(
    "--purchase-year-series",
    "assign explicit YYYY-NNNN stock numbers by purchase year (chronological) instead of the DB trigger",
    false,
  )
  .option("--batch-size <n>", "insert batch size", "100")
  .action(async (opts: { acceptMakers: boolean; purchaseYearSeries: boolean; batchSize: string }) => {
    if (!fs.existsSync(CLEANED_JSON)) {
      console.error(`Missing ${CLEANED_JSON} — run \`pnpm migrate clean\` first.`);
      process.exit(1);
    }
    const cleaned = readJson<CleanedRow[]>(CLEANED_JSON);
    const db = getSupabase();
    try {
      await runFinalize(db, cleaned, {
        acceptMakers: opts.acceptMakers,
        purchaseYearSeries: opts.purchaseYearSeries,
        batchSize: Math.max(1, Number(opts.batchSize) || 100),
      });
    } catch (err) {
      console.error(`finalize failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error("finalize is idempotent — fix the cause and re-run; linked rows are skipped.");
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// scan-images (offline)
// ---------------------------------------------------------------------------
program
  .command("scan-images")
  .description("Walk an image directory recursively -> out/image-manifest.csv")
  .requiredOption("--dir <path>", "root directory of legacy image folders")
  .action(async (opts: { dir: string }) => {
    if (!fs.existsSync(opts.dir) || !fs.statSync(opts.dir).isDirectory()) {
      console.error(`Not a directory: ${opts.dir}`);
      process.exit(1);
    }
    const entries = await scanImages(opts.dir);
    writeCsv(
      MANIFEST_CSV,
      entries.map((e) => ({ ...e })),
      ["filename", "relative_path", "bytes", "sha256"],
    );
    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    console.log(
      `Scanned ${entries.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB) -> ${MANIFEST_CSV}`,
    );
  });

// ---------------------------------------------------------------------------
// match-images (offline)
// ---------------------------------------------------------------------------
program
  .command("match-images")
  .description("Match out/image-manifest.csv against container filenames in raw.json")
  .action(() => {
    if (!fs.existsSync(MANIFEST_CSV)) {
      console.error(`Missing ${MANIFEST_CSV} — run \`pnpm migrate scan-images --dir <path>\` first.`);
      process.exit(1);
    }
    const manifest: ManifestEntry[] = readCsv<Record<string, string>>(MANIFEST_CSV).map((r) => ({
      filename: r["filename"] ?? "",
      relative_path: r["relative_path"] ?? "",
      bytes: Number(r["bytes"] ?? 0),
      sha256: r["sha256"] ?? "",
    }));
    const rows = readRawRows();

    const out: Array<Record<string, unknown>> = [];
    const statByType = new Map<string, number>();
    for (const row of rows) {
      for (const column of CONTAINER_COLUMNS) {
        const filename = toText(row.data[column]);
        if (!filename) continue;
        const match = matchFilename(filename, manifest);
        statByType.set(match.match_type, (statByType.get(match.match_type) ?? 0) + 1);
        out.push({
          row_number: row.row_number,
          container: column,
          container_filename: filename,
          match_type: match.match_type,
          matched_path: match.matched_path ?? "",
          candidates: match.candidates,
        });
      }
    }
    writeCsv(MATCHES_CSV, out, [
      "row_number",
      "container",
      "container_filename",
      "match_type",
      "matched_path",
      "candidates",
    ]);
    console.log(`Matched ${out.length} container references -> ${MATCHES_CSV}`);
    for (const [type, count] of [...statByType].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(5)}  ${type}`);
    }
  });

// ---------------------------------------------------------------------------
// report (offline)
// ---------------------------------------------------------------------------
program
  .command("report")
  .description("Summarize migration state -> out/migration-report.md")
  .action(() => {
    const lines: string[] = [
      "# FileMaker migration report",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
    ];

    if (fs.existsSync(RAW_JSON)) {
      const rows = readJson<RawRow[]>(RAW_JSON);
      const stats = stockStats(rows);
      const dupRows = [...stats.duplicateValues.values()].reduce((n, v) => n + v.length, 0);
      lines.push(
        "## Rows",
        "",
        `- Rows parsed: **${rows.length}**`,
        `- Stock number blank: **${stats.blank}**`,
        `- Stock numbers duplicated: **${stats.duplicateValues.size}** distinct values across **${dupRows}** rows`,
        "",
      );
    } else {
      lines.push("## Rows", "", "_out/raw.json missing — run `pnpm migrate parse`._", "");
    }

    lines.push("## Mapping coverage", "");
    let anyMapping = false;
    for (const file of ["category.csv", "location.csv", "status.csv", "published.csv"]) {
      const filePath = path.join(MAPPINGS_DIR, file);
      if (!fs.existsSync(filePath)) continue;
      anyMapping = true;
      const rows = readCsv<Record<string, string>>(filePath);
      const unknown = rows.filter((r) => r["proposed_kind"] === "unknown").length;
      const kinds = new Map<string, number>();
      for (const r of rows) {
        const k = r["proposed_kind"] ?? "unknown";
        kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
      const kindSummary = [...kinds]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k}: ${n}`)
        .join(", ");
      lines.push(
        `- **${file}** — ${rows.length} distinct values, ${rows.length - unknown} with a proposal ` +
          `(${((100 * (rows.length - unknown)) / Math.max(1, rows.length)).toFixed(0)}%). ${kindSummary}`,
      );
    }
    if (!anyMapping) lines.push("_No mapping CSVs — run `pnpm migrate gen-mappings`._");
    lines.push("");

    lines.push("## Cleaning issues", "");
    if (fs.existsSync(ISSUES_CSV)) {
      const issues = readCsv<Record<string, string>>(ISSUES_CSV) as unknown as CleanIssue[];
      lines.push(`Total issues: **${issues.length}**`, "", "| Issue | Count |", "| --- | ---: |");
      for (const [issue, count] of issueCounts(issues)) {
        lines.push(`| ${issue} | ${count} |`);
      }
    } else {
      lines.push("_out/issues.csv missing — run `pnpm migrate clean`._");
    }
    lines.push("");

    lines.push("## Image matching", "");
    if (fs.existsSync(MATCHES_CSV)) {
      const matches = readCsv<Record<string, string>>(MATCHES_CSV);
      const byType = new Map<string, number>();
      for (const m of matches) {
        const t = m["match_type"] ?? "unmatched";
        byType.set(t, (byType.get(t) ?? 0) + 1);
      }
      lines.push(
        `Container references checked: **${matches.length}**`,
        "",
        "| Match type | Count |",
        "| --- | ---: |",
      );
      for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) {
        lines.push(`| ${t} | ${n} |`);
      }
    } else if (fs.existsSync(MANIFEST_CSV)) {
      lines.push("_Manifest exists but no matches — run `pnpm migrate match-images`._");
    } else {
      lines.push("_No image manifest — run `pnpm migrate scan-images --dir <path>` when the image folders are available._");
    }
    lines.push("");

    ensureDir(OUT_DIR);
    fs.writeFileSync(REPORT_MD, lines.join("\n"));
    console.log(`Report -> ${REPORT_MD}\n`);
    console.log(lines.join("\n"));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
