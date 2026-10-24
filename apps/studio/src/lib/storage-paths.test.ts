// node --test apps/studio/src/lib/storage-paths.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- node --test needs the extension, which the app's tsconfig does not allow
import { makerPortraitPath, makerPortraitUploadPath, pieceDisplayPath, publishablePath } from "./storage-paths.ts";

const piece = "0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const other = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const image = "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b";
const maker = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f";

test("display masters and tiles the worker and the sync write", () => {
  for (const p of [`${piece}/${image}.jpg`, `${piece}/${image}.sq-1600x1600.jpg`, `${piece}/${image}.display.jpg`]) {
    assert.equal(pieceDisplayPath(p, piece), p);
    assert.equal(publishablePath("piece-derivatives", p, piece), p);
    assert.equal(publishablePath("piece-derivatives", p), p);
  }
});

test("display paths outside the row's own work, or out of the bucket, are refused", () => {
  for (const p of [
    `${piece}/../../piece-documents/${piece}/${image}.pdf`,
    `${piece}/%2e%2e/x.jpg`,
    `${other}/${image}.jpg`,
    `${piece}/sub/${image}.jpg`,
    `${piece}/${image}.pdf`,
    `${image}.jpg`,
    `../piece-documents/${image}.jpg`,
    null,
  ]) {
    assert.equal(pieceDisplayPath(p, piece), null, String(p));
    assert.equal(publishablePath("piece-derivatives", p, piece), null, String(p));
  }
  // A malformed owner id never builds a pattern.
  assert.equal(pieceDisplayPath(`../${image}.jpg`, ".."), null);
});

test("portraits under the maker's own id", () => {
  for (const p of [`${maker}/display-1760000000000.jpg`, `${maker}/original-1760000000000.heic`, `${maker}/portrait.jpg`]) {
    assert.equal(makerPortraitPath(p, maker), p);
    assert.equal(publishablePath("maker-portraits", p, maker), p);
  }
  for (const p of [`${other}/display-1.jpg`, `${maker}/../piece-documents/x.jpg`, "../kyc-documents/x.jpg", `${maker}/a/b.jpg`]) {
    assert.equal(makerPortraitPath(p, maker), null, p);
    assert.equal(publishablePath("maker-portraits", p, maker), null, p);
  }
});

test("a portrait upload names the original the upload route signed", () => {
  assert.equal(makerPortraitUploadPath(`${maker}/original-1760000000000.jpg`, maker), `${maker}/original-1760000000000.jpg`);
  for (const p of [
    `${maker}/original-1/../../piece-documents/x.jpg`,
    `${maker}/original-x.jpg`,
    `${maker}/display-1.jpg`,
    `${other}/original-1.jpg`,
  ]) {
    assert.equal(makerPortraitUploadPath(p, maker), null, p);
  }
});

test("buckets the sync does not publish from are refused", () => {
  assert.equal(publishablePath("piece-documents", `${piece}/${image}.jpg`), null);
  assert.equal(publishablePath("kyc-documents", `${piece}/${image}.jpg`), null);
});
