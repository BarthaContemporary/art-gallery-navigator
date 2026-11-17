// node --test apps/studio/src/lib/storage-paths.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore -- node --test needs the extension, which the app's tsconfig does not allow
import { documentFilePath, makerPortraitPath, makerPortraitUploadPath, pieceDisplayPath, pieceOriginalPath, planStorageRemovals, publishablePath, queuedRemovalPath } from "./storage-paths.ts";

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

const shipment = "5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f";
const doc = "7e8f9a0b-1c2d-4e3f-9a4b-5c6d7e8f9a0b";

test("originals the uploader, Quick Capture and the FileMaker import write", () => {
  for (const p of [`${piece}/${doc}.jpg`, `${piece}/${image}.heic`, `${piece}/${image}.JPG`]) {
    assert.equal(pieceOriginalPath(p, piece), p);
  }
  for (const p of [`${other}/${image}.jpg`, `${piece}/${image}`, `${piece}/a/${image}.jpg`, `${piece}/../piece-documents/${doc}.pdf`, null]) {
    assert.equal(pieceOriginalPath(p, piece), null, String(p));
  }
});

test("document files under a work, a shipment or the registry", () => {
  for (const p of [`${piece}/${doc}.pdf`, `shipments/${shipment}/${doc}.pdf`, `documents/${doc}.docx`]) {
    assert.equal(documentFilePath(p), p);
  }
  for (const p of [
    `shipments/${doc}.pdf`,
    `shipments/not-a-uuid/${doc}.pdf`,
    `documents/x/${doc}.pdf`,
    `invoices/${doc}.pdf`,
    `${piece}/sub/${doc}.pdf`,
    `${piece}/../../kyc-documents/${doc}.pdf`,
    `${piece}/${doc}`,
    "",
  ]) {
    assert.equal(documentFilePath(p), null, p);
  }
});

test("a queued removal is checked with its bucket's own rule", () => {
  assert.equal(queuedRemovalPath("piece-originals", `${piece}/${doc}.tif`), `${piece}/${doc}.tif`);
  assert.equal(queuedRemovalPath("piece-derivatives", `${piece}/${image}.jpg`), `${piece}/${image}.jpg`);
  assert.equal(queuedRemovalPath("piece-derivatives", `${piece}/${image}.sq-1600x1600.jpg`), `${piece}/${image}.sq-1600x1600.jpg`);
  assert.equal(queuedRemovalPath("maker-portraits", `${maker}/display-17.jpg`), `${maker}/display-17.jpg`);
  assert.equal(queuedRemovalPath("piece-documents", `shipments/${shipment}/${doc}.pdf`), `shipments/${shipment}/${doc}.pdf`);
  // A display master that is not a jpg, a file outside any UUID folder, a
  // climb out of the bucket, buckets the sweep does not cover, a non-string.
  assert.equal(queuedRemovalPath("piece-derivatives", `${piece}/${image}.png`), null);
  assert.equal(queuedRemovalPath("piece-originals", `legacy/${image}.jpg`), null);
  assert.equal(queuedRemovalPath("maker-portraits", `${maker}/../piece-documents/${doc}.pdf`), null);
  assert.equal(queuedRemovalPath("kyc-documents", `${piece}/${doc}.pdf`), null);
  assert.equal(queuedRemovalPath("captures", `works/${piece}/${doc}.jpg`), null);
  assert.equal(queuedRemovalPath("piece-documents", 42), null);
});

test("the sweep removes checked keys by bucket and refuses the rest", () => {
  const plan = planStorageRemovals([
    { bucket: "piece-originals", path: `${piece}/${doc}.jpg` },
    { bucket: "piece-derivatives", path: `${piece}/${image}.jpg` },
    { bucket: "piece-derivatives", path: `${piece}/${image}.sq-10x10.jpg` },
    { bucket: "piece-documents", path: `${piece}/../../x.pdf` },
    { bucket: "kyc-documents", path: `${piece}/${doc}.pdf` },
  ]);
  assert.deepEqual([...plan.remove.entries()], [
    ["piece-originals", [`${piece}/${doc}.jpg`]],
    ["piece-derivatives", [`${piece}/${image}.jpg`, `${piece}/${image}.sq-10x10.jpg`]],
  ]);
  assert.deepEqual([...plan.refused.entries()], [
    ["piece-documents", [`${piece}/../../x.pdf`]],
    ["kyc-documents", [`${piece}/${doc}.pdf`]],
  ]);
});
