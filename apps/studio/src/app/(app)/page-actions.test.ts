// node "apps/studio/src/app/(app)/page-actions.test.ts"
// (node --test would read the brackets as a glob; pnpm test:unit finds it.)
//
// Reads and server actions inside studio pages, which node --test cannot
// load (.tsx with server-only imports): checked on the source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
/** The body of `async function <name>(` up to the next function at the same depth. */
const action = (src: string, name: string) =>
  src.match(new RegExp(`async function ${name}\\([\\s\\S]*?\\n  \\}\\n`))?.[0] ?? "";

test("stock book: the screen reads every row, in the exports' order", () => {
  const src = page("./stock-book/page.tsx");
  assert.match(src, /rows = await selectAllRows<Record<string, unknown>>\(\(start, end\) => \{/);
  assert.match(src, /supabase\.from\(view\)\.select\("\*"\)\.order\("stock_number"\)\.order\("piece_id"\)/);
  assert.match(src, /return query\.range\(start, end\)/);
  // The CSV export uses the same order.
  const csv = page("../api/export/stock-book.csv/route.ts");
  assert.match(csv, /\.order\("stock_number"\)\.order\("piece_id"\)/);
});

test("images page: delete and caption check the role, report errors and refused writes, and stay on this work", () => {
  const src = page("./inventory/[stockNumber]/images/page.tsx");
  for (const name of ["deleteImage", "saveCaption"]) {
    const body = action(src, name);
    assert.ok(body, name);
    assert.match(body, /const s = await getSession\(\);\n\s+if \(!s \|\| !canEditRecords\(s\.roles\)\) redirect\(withError\(/, name);
    assert.match(body, /\.eq\("piece_id", pieceId\)\n\s+\.select\("id"\);/, name);
    assert.match(body, /if \(error\) redirect\(withError\(/, name);
    assert.match(body, /if \(!data \|\| data\.length === 0\) \{\n\s+redirect\(withError\(/, name);
  }
  assert.match(src, /<FlashNotice searchParams=\{sp\}/);
});

test("record page: the history read names the work's tables, so the log's index serves it", () => {
  const src = page("./inventory/[stockNumber]/page.tsx");
  const read = src.match(/\.from\("activity_log"\)\n\s+\.select\(\n\s+isAdmin[\s\S]*?\.limit\(isAdmin \? 200 : 6\)/)?.[0] ?? "";
  assert.match(read, /\.in\("entity_type", \["pieces", "external_pieces", "piece_financials"\]\)\n\s+\.eq\("entity_id", piece\.id\)/);
});

test("admin page: recent changes are read newest first by id", () => {
  const src = page("./admin/page.tsx");
  assert.match(src, /\.select\("id, actor_id, entity_type, entity_id, action, created_at"\)[\s\S]{0,300}\.order\("id", \{ ascending: false \}\)\n\s+\.limit\(15\)/);
});

test("newsletter send: the claim matches the status and the updated_at that were read", () => {
  const body = action(page("./crm/campaigns/[id]/page.tsx"), "sendCampaign");
  assert.match(
    body,
    /\.update\(\{ status: "sending" \}\)\n\s+\.eq\("id", id\)\n\s+\.eq\("status", cc!\.status\)\n\s+\.eq\("updated_at", cc!\.updated_at\)\n\s+\.select\("id"\);/,
  );
  assert.doesNotMatch(body, /if \(cc!\.status === "sending"\) claim = claim\.eq\("updated_at"/);
});
