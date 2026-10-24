// node --test apps/studio/src/lib/website-images.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extensions; the studio's tsconfig does not
// allow them, hence the two ignores (the types still come through).
// @ts-ignore TS5097
import { displayMasterRule, isWebsiteRole, portraitRule, squareTileRule, syncUploadImageId, WEBSITE_IMAGE_ROLES } from "./website-images.ts";
// @ts-ignore TS5097
import { safeStoragePath } from "../../../../packages/db/src/storage-path.ts";

const piece = "0b8f7c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";
const image = "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b";
const other = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

test("only views of the work are website roles", () => {
  for (const r of ["front", "side", "signature", "box", "detail"]) assert.equal(isWebsiteRole(r), true, r);
  for (const r of ["back", "condition", "document", "other", "", null, undefined, "FRONT"]) assert.equal(isWebsiteRole(r), false, String(r));
  assert.deepEqual([...WEBSITE_IMAGE_ROLES].sort(), ["box", "detail", "front", "side", "signature"]);
});

test("display master: the worker's own path and nothing else", () => {
  const rule = displayMasterRule(piece, image);
  assert.equal(safeStoragePath(`${piece}/${image}.jpg`, rule), `${piece}/${image}.jpg`);
  for (const p of [
    `${piece}/${image}.sq-1600x1600.jpg`,
    `${piece}/${other}.jpg`,
    `${other}/${image}.jpg`,
    `${piece}/../../piece-documents/${piece}/${other}.pdf`,
    `${piece}/%2e%2e/piece-documents/x.pdf`,
    `/${piece}/${image}.jpg`,
    `${piece}/${image}.jpg/../x.jpg`,
    `${piece}/${image}.JPG`,
    null,
  ]) {
    assert.equal(safeStoragePath(p, rule), null, String(p));
  }
});

test("square tile: rendered beside its own master", () => {
  const rule = squareTileRule(piece, image);
  assert.equal(safeStoragePath(`${piece}/${image}.sq-4096x2731.jpg`, rule), `${piece}/${image}.sq-4096x2731.jpg`);
  for (const p of [`${piece}/${image}.jpg`, `${piece}/${other}.sq-10x10.jpg`, `${piece}/${image}.sq-x.jpg`, `${piece}/../${image}.sq-10x10.jpg`]) {
    assert.equal(safeStoragePath(p, rule), null, p);
  }
});

test("portrait: one file in the maker's own folder", () => {
  const rule = portraitRule(piece);
  for (const p of [`${piece}/display-1760000000000.jpg`, `${piece}/portrait.jpg`]) assert.equal(safeStoragePath(p, rule), p);
  for (const p of [`${other}/display-1.jpg`, `${piece}/sub/display-1.jpg`, `${piece}/../${other}/display-1.jpg`, `${piece}/`, piece]) {
    assert.equal(safeStoragePath(p, rule), null, p);
  }
});

test("ids that are not UUIDs match nothing", () => {
  for (const rule of [displayMasterRule("x", image), displayMasterRule(piece, ".*"), squareTileRule(piece, "a|b"), portraitRule("..")]) {
    assert.equal(safeStoragePath(`${piece}/${image}.jpg`, rule), null);
  }
});

test("recognises the sync's own upload names", () => {
  assert.equal(syncUploadImageId(`${image}.jpg`), image);
  assert.equal(syncUploadImageId(`${image}.sq-1600x1600.jpg`), image);
  for (const f of ["IMG_1234.jpg", `${image}.png`, `${image.toUpperCase()}.jpg`, `x${image}.jpg`, `${image}.jpg.jpg`, "display-1760000000000.jpg", "", null, undefined]) {
    assert.equal(syncUploadImageId(f), null, String(f));
  }
});
