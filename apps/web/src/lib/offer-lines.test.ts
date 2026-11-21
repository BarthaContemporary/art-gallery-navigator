// node --test apps/web/src/lib/offer-lines.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OFFER_IMAGE_ROLES, orderOfferLines, primaryImage } from "./offer-lines.ts";
import { WEBSITE_IMAGE_ROLES } from "../../../studio/src/lib/website-images.ts";
import { chunkIds, ChunkReadError, selectInChunks } from "./chunk.ts";

const img = (role: string | null, sort_order: number, extra: Partial<{ storage_path_display: string | null; processing_status: string | null }> = {}) => ({
  role,
  sort_order,
  storage_path_display: `p/${role}-${sort_order}.jpg`,
  processing_status: "done",
  ...extra,
});

test("a work in the Trash drops off the private offer page: its read skips deleted rows", () => {
  const page = readFileSync(new URL("../app/o/[token]/page.tsx", import.meta.url), "utf8");
  const read = page.match(/\.from\("vw_pieces_all"\)[\s\S]*?\),\n\s+\),/)?.[0] ?? "";
  assert.match(read, /\.in\("id", chunk\)/);
  assert.match(read, /\.is\("deleted_at", null\)/);
});

test("the offer page shows the same image roles as the website", () => {
  assert.deepEqual([...OFFER_IMAGE_ROLES], [...WEBSITE_IMAGE_ROLES]);
});

test("a label shot, back or condition photograph is never the work's picture", () => {
  // Label shot first, front still processing: the detail is shown, not the document.
  const pick = primaryImage([
    img("document", 0),
    img("front", 1, { storage_path_display: null }),
    img("detail", 2),
  ]);
  assert.equal(pick?.role, "detail");
  assert.equal(primaryImage([img("document", 0), img("back", 1), img("condition", 2), img("other", 3)]), null);
  assert.equal(primaryImage([img(null, 0)]), null);
});

test("the front wins over a lower sort_order; failed images are skipped", () => {
  assert.equal(primaryImage([img("detail", 0), img("front", 3)])?.role, "front");
  assert.equal(primaryImage([img("front", 0, { processing_status: "error" }), img("side", 4)])?.role, "side");
  assert.equal(primaryImage(null), null);
});

test("offer lines follow the studio's sort_order, id breaking ties, without mutating", () => {
  const lines = [
    { id: "c", sort_order: 2 },
    { id: "b", sort_order: 0 },
    { id: "a", sort_order: 0 },
    { id: "d", sort_order: null },
  ];
  const ordered = orderOfferLines(lines).map((l) => l.id);
  assert.deepEqual(ordered, ["a", "b", "d", "c"]);
  assert.deepEqual(lines.map((l) => l.id), ["c", "b", "a", "d"]);
  assert.deepEqual(orderOfferLines(null), []);
});

test("ids are split into chunks of 100", () => {
  assert.deepEqual(chunkIds([]), []);
  assert.deepEqual(chunkIds(["a"]), [["a"]]);
  const ids = Array.from({ length: 240 }, (_, i) => String(i));
  assert.deepEqual(chunkIds(ids).map((c) => c.length), [100, 100, 40]);
});

test("selectInChunks reads every chunk once, keeps order and de-duplicates", async () => {
  const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
  const seen: number[] = [];
  const rows = await selectInChunks([...ids, "id-3", ""], async (chunk) => {
    seen.push(chunk.length);
    return { data: chunk.map((id) => ({ id })), error: null };
  });
  assert.deepEqual(seen.sort((a, b) => b - a), [100, 100, 50]);
  assert.deepEqual(rows.map((r) => r.id), ids);
  assert.deepEqual(await selectInChunks([], async () => ({ data: [{ id: "x" }], error: null })), []);
});

test("a failed chunk throws instead of returning a short list", async () => {
  const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
  await assert.rejects(
    selectInChunks(ids, async (chunk) =>
      chunk[0] === "id-100"
        ? { data: null, error: { message: "URI too long", code: "414" } }
        : { data: chunk.map((id) => ({ id })), error: null },
    ),
    (e: unknown) => e instanceof ChunkReadError && e.code === "414",
  );
});
