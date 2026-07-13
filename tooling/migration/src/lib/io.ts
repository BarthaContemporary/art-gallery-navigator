import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import type { RawRow } from "./columns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Package root (tooling/migration), independent of cwd. */
export const PKG_ROOT = path.resolve(__dirname, "..", "..");
export const DATA_DIR = path.join(PKG_ROOT, "data");
export const OUT_DIR = path.join(PKG_ROOT, "out");
export const DEFAULT_XLSX = path.join(DATA_DIR, "FileMaker_complete_records.xlsx");
export const RAW_JSON = path.join(OUT_DIR, "raw.json");
export const CLEANED_JSON = path.join(OUT_DIR, "cleaned.json");
export const ISSUES_CSV = path.join(OUT_DIR, "issues.csv");
export const MAPPINGS_DIR = path.join(OUT_DIR, "mappings");
export const MANIFEST_CSV = path.join(OUT_DIR, "image-manifest.csv");
export const MATCHES_CSV = path.join(OUT_DIR, "image-matches.csv");
export const REPORT_MD = path.join(OUT_DIR, "migration-report.md");

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function readRawRows(): RawRow[] {
  if (!fs.existsSync(RAW_JSON)) {
    throw new Error(`Missing ${RAW_JSON} — run \`pnpm migrate parse\` first.`);
  }
  return readJson<RawRow[]>(RAW_JSON);
}

export function writeCsv(
  filePath: string,
  rows: Array<Record<string, unknown>>,
  columns: string[],
): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, Papa.unparse(rows as never, { columns }) + "\n");
}

export function readCsv<T extends Record<string, string>>(filePath: string): T[] {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<T>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error in ${filePath}: ${first?.message} (row ${first?.row})`);
  }
  return parsed.data;
}
