# Squarespace → Sanity import

Moves the old joostvandenbergh.com (Squarespace) content — exhibitions with
their catalogued works, publications with page spreads, the About page — into
the Sanity dataset behind this site. One direction only, one time: nothing
here touches the inventory, and the inventory-synced `work` documents are
never written by this tooling.

Everything is idempotent. Re-running any step overwrites its own output only.

## Run order

```sh
cd apps/web

# 1. Fetch every page as JSON + the sitemap + home HTML into .cache/ (≈1 min)
node scripts/import-squarespace/crawl.mjs

# 2. Parse into content.json, write the three review CSVs and
#    redirects/squarespace.json (committed — the site's permanent redirects)
node scripts/import-squarespace/parse.mjs

# 3. Download the original images (≈1,500 files, ≈450 MB, resumable)
node scripts/import-squarespace/download.mjs

# 4. Build the import file, folding in any corrections from .cache/in/
node scripts/import-squarespace/build-ndjson.mjs

# 5. Import. Needs a Sanity token with Editor rights on the dataset:
#    either `pnpm exec sanity login` once, or SANITY_AUTH_TOKEN in the env.
#    Do it against a staging dataset first.
SANITY_PROJECT_ID=… pnpm exec sanity dataset import \
  scripts/import-squarespace/.cache/out/import.ndjson staging --replace
```

`--replace` overwrites documents with the same id, which is what you want on
a re-run. Images are de-duplicated by the importer using content hashes.

## The review round-trip

Step 2 writes, under `.cache/out/`:

| File | One row per | What to do with it |
| --- | --- | --- |
| `review-works.csv` | catalogue entry (work image) | Check the split of the caption into reference / maker / title / medium / origin / dimensions. Rows marked `medium` are the irregular captions; `no caption on old site` rows have only an image. |
| `review-exhibitions.csv` | exhibition | Fill in venue, start and end dates. Set `hidden` to `yes` for anything not to publish. |
| `review-publications.csv` | catalogue | Check year / pages / format and the paired exhibition. |

Edit them (Excel, Numbers, Google Sheets), save as CSV with the same names into
`.cache/in/`, and re-run step 4. Matching is by `image_id` (works) or `slug`.
An empty cell keeps the parsed value; the word `clear` empties the field.

## What the parser knows

- Captions come in three generations, all pipe-separated with the exhibition's
  reference code at one end and `SOLD` appended where relevant. The parser
  handles all three and keeps `rawCaption` verbatim on every entry.
- Eleven of the older exhibitions have no captions on the old site at all —
  their images carry only filenames. Those entries import as image-only and
  the filename is in the review sheet to help match them to gallery records.
- Squarespace's demo copy ("Whatever it is, the way you tell your story…") is
  recognised and dropped.
- Order comes from the site navigation (newest first); `sortOrder` is only the
  fallback until real dates are entered in Sanity.
- `(Copy)` pages and pages with no body are dropped and redirected to their
  canonical page.

## Document ids

`exhibition-sq-<slug>`, `publication-sq-<slug>`, `page-sq-about`. The `sq`
marks them as migrated; editors can rename slugs freely afterwards (the
redirect file is what maps old URLs, and it's committed — regenerate it with
step 2 if slugs are changed *before* import).

If an About page already exists in the dataset, keep one of the two.

## Working data

`.cache/` is gitignored: fetched pages, images and the import file are
working data, not source. The only committed output is
`redirects/squarespace.json`.
