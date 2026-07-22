# @jvb/migration — FileMaker migration CLI

Staged, idempotent, auditable migration of the legacy FileMaker export
(1,087 rows / 50 columns) into the Supabase schema
(see `docs/BUILD_PLAN.md` §3 and §5).

## Safety: sensitive data

The FileMaker export contains commercially sensitive records (costs, margins,
buyers). **Real data must never be committed.**

- `data/` — put the source spreadsheet here: `data/FileMaker_complete_records.xlsx`
- `out/` — all generated artefacts (raw.json, cleaned.json, mapping CSVs, reports)

Both directories are gitignored (only the `.gitkeep` markers are tracked).
The `SUPABASE_SERVICE_ROLE_KEY` is likewise never written to disk — pass it via
environment only.

## Setup

```sh
cd tooling/migration
pnpm install            # (use `pnpm install --ignore-workspace` for a local-only install)
```

Offline commands need nothing else. DB commands need:

```sh
export SUPABASE_URL=https://api.<domain>
export SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

## Staged workflow (run in this order)

| # | Command | Mode | What it does |
|---|---------|------|--------------|
| 1 | `pnpm migrate parse` | offline | Reads the xlsx (exceljs) → `out/raw.json` (rows keyed by exact header, sheet row numbers preserved) + prints column fill rates. |
| 2 | `pnpm migrate gen-mappings` | offline | Distinct-value review CSVs → `out/mappings/{category,location,status,published}.csv` with columns `raw_value,count,proposed_kind,proposed_value,notes` and smart proposals (SOLD→status, regions→origin_region, `SJ - B2`→`SJ-B2`, `X`→web_published, `Name (2021)`→buyer_note). **The dealer reviews/edits these CSVs** — proposals are never applied unreviewed. |
| 3 | `pnpm migrate clean` | offline | All cleaning passes → `out/cleaned.json` + `out/issues.csv` (`row_number,field,issue,raw_value`): dimensions (numeric columns with 0.1–500 cm sanity bounds → `15.5cm` strings → Description regex incl. `H: 23.5 x W: 22 cm` and `Ø`), maker extraction (proposals only, flagged `maker_proposed`), currency symbols → ISO codes + `purchase_cost_gbp = cost × FX`, `Item` → box_type/box_notes, status resolution (Category/Status/Description/Sold price signals), stock number normalization + blank/duplicate flags. |
| 4 | `pnpm migrate load-raw [--batch <label>]` | **DB** | Upserts every raw row into `legacy_filemaker_rows` (`row_number`, `raw` jsonb, `import_batch`) — the permanent audit snapshot. |
| 5 | `pnpm migrate import-mappings --dir <reviewed-dir>` | **DB** | Loads the dealer-reviewed CSVs into `legacy_value_mappings` (marked `reviewed`). Point `--dir` at the folder holding the reviewed copies. |
| 6 | `pnpm migrate scan-images --dir <image-root>` | offline | Recursive walk → `out/image-manifest.csv` (`filename,relative_path,bytes,sha256`). Re-runnable as more folders surface. |
| 7 | `pnpm migrate match-images` | offline | Manifest × container filenames → `out/image-matches.csv` with `match_type` exact / case_insensitive / fuzzy (extension-insensitive, then Levenshtein ≤ 2) / ambiguous (largest file wins, flagged) / unmatched. |
| 8 | `pnpm migrate finalize [--accept-makers] [--purchase-year-series]` | **DB** | cleaned.json + reviewed mappings → `makers` (only with `--accept-makers`, dedup by normalized name), `pieces` (legacy_stock_number verbatim + conflict flag; stock_number left to the DB trigger, or explicit chronological `YYYY-NNNN` per purchase year with `--purchase-year-series`, which also seeds `stock_number_counters` above the migrated maxima), `piece_financials` (vat_treatment `standard` when `VAT Yes == 'Y'`, else `margin_scheme` + `vat_review_needed`), `provenance_entries` from buyer_note mappings, `piece_images` stubs (Container1 → `front`, others `detail`), and links `legacy_filemaker_rows.piece_id`. Batches of 100 with progress; **idempotent** — rows whose legacy row already has `piece_id` are skipped, so re-run after any failure. |
| 8b | `pnpm migrate attach-images --dir <image-root> [--dry-run] [--force]` | **DB** | Walk the exported-images folder, match each file to a `piece_images` stub by its `legacy_container_filename` (exact → case-insensitive; largest wins when a name repeats, flagged ambiguous), upload it to `piece-originals/<piece_id>/<image_id>.<ext>`, and set `storage_path_original` + `processing_status='pending'`. The image-worker then generates the display master + thumbnails. Idempotent — stubs that already have an original are skipped unless `--force`. Prints matched / ambiguous / unmatched counts; `--dry-run` reports without uploading. |
| 9 | `pnpm migrate report` | offline | `out/migration-report.md`: row counts, stock number stats, mapping coverage, issue counts by type, image match stats. Run at any stage; it reports on whatever artefacts exist. |

## Known data quirks handled

- `'Purchase  cost'` has two spaces; `'Photograper'` and `'Sold price in Defult Currency'` are sic.
- 747 rows lack a stock number; 54 numbers are duplicated → blank/duplicate issues + `legacy_stock_number_conflict`.
- `Category` mixes codes (`A`,`C`), regions (`India`, `Japanese`, …) and status (`SOLD`, `Sold?`, `SOLD/gift`).
- `Location` mixes storage codes (`SJ - B2`, `PP`, `Auction`) and origin regions (`Rajasthan, India`).
- Dimension columns contain garbage (`H in = 914`) and strings (`15.5cm`); real dimensions often live in Description free text.
- Maker names + life dates embedded in Description (`Yoneda Bishō (1929-2008)`) — extracted as proposals only.
- `Published` misused for buyer names / export notes (`Rose Uniacke (2021)`) → provenance via mapping review.
- Currency symbols `£ ¥ € $` → GBP/JPY/EUR/USD.
- `Item` holds tomobako notes (`Box signed`, `fitted wood box`, …; `New Item`/`NO` are noise).

## Expected staging tables

`finalize`/`load-raw`/`import-mappings` expect the BUILD_PLAN §3 staging tables
(added alongside the main schema migrations):

```sql
create table public.legacy_filemaker_rows (
  id           uuid primary key default gen_random_uuid(),
  row_number   int not null unique,       -- xlsx sheet row number
  raw          jsonb not null,            -- full row keyed by exact header
  import_batch text,
  piece_id     uuid references public.pieces (id) on delete set null,
  issues       text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table public.legacy_value_mappings (
  id           uuid primary key default gen_random_uuid(),
  field        text not null,             -- category | location | status | published
  raw_value    text not null,
  mapped_kind  text,                      -- status | origin_region | category_code | storage_location | web_published | buyer_note | unknown
  mapped_value text,
  notes        text,
  reviewed     boolean not null default false,
  unique (field, raw_value)
);
```

## Development

```sh
pnpm typecheck   # tsc --noEmit
```

Parsing/cleaning helpers live in `src/lib/*.ts` as pure functions
(dimensions, maker extraction, currency, box, stock numbers, mapping
proposals, Levenshtein) so they can be unit-tested without I/O.
