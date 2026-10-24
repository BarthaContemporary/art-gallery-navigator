// node --test packages/db/src/storage-path.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertStoragePath, safeStoragePath, UUID_PATTERN } from "./storage-path.ts";

const piece = "0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

test("accepts plain object keys", () => {
  for (const p of [
    `${piece}/1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b.jpg`,
    `${piece}/1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b.sq-1600x1600.jpg`,
    "documents/1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b.pdf",
    "shipments/abc/def_ghi-1.png",
  ]) {
    assert.equal(safeStoragePath(p), p);
  }
});

test("refuses traversal in every form", () => {
  for (const p of [
    "..",
    ".",
    `${piece}/../piece-documents/x.pdf`,
    `${piece}/./x.jpg`,
    "../piece-documents/x.pdf",
    `${piece}/%2e%2e/x.pdf`,
    `${piece}/%2E%2E/x.pdf`,
    `${piece}%2fx.pdf`,
    `${piece}\\..\\x.pdf`,
    "/absolute/x.jpg",
    "a//b.jpg",
    "trailing/",
    "",
    "a/b\u0000.jpg",
    "a/b\n.jpg",
    "a/b c.jpg",
    "x".repeat(513),
  ]) {
    assert.equal(safeStoragePath(p), null, JSON.stringify(p));
  }
});

test("refuses non-strings", () => {
  for (const p of [null, undefined, 1, {}, ["a"]]) assert.equal(safeStoragePath(p), null);
});

test("prefix and pattern rules", () => {
  const ok = `${piece}/1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b.jpg`;
  assert.equal(safeStoragePath(ok, { prefix: `${piece}/` }), ok);
  assert.equal(safeStoragePath(ok, { prefix: "other/" }), null);
  const pattern = new RegExp(`^${piece}/${UUID_PATTERN}(\\.sq-\\d+x\\d+)?\\.jpg$`);
  assert.equal(safeStoragePath(ok, { pattern }), ok);
  assert.equal(safeStoragePath(`${piece}/notes.jpg`, { pattern }), null);
});

test("assertStoragePath throws on refusal", () => {
  assert.throws(() => assertStoragePath("../x"));
  assert.equal(assertStoragePath("a/b.jpg"), "a/b.jpg");
});
