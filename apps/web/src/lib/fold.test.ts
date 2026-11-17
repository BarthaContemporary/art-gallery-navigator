// node --test apps/web/src/lib/fold.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fold, foldedTerms, highlightParts } from "./fold.ts";

test("long-vowel marks and other Latin accents fold away", () => {
  assert.equal(fold("Hatanaka Hōzan"), "hatanaka hozan");
  assert.equal(fold("Ōhara"), "ohara");
  assert.equal(fold("Kobayashi Shômin"), "kobayashi shomin");
  assert.equal(fold("Itō Shōwa"), "ito showa");
  // A decomposed o + U+0304 folds the same as the precomposed letter.
  assert.equal(fold("Hōzan"), "hozan");
  assert.deepEqual(foldedTerms("  HŌZAN  hatanaka "), ["hozan", "hatanaka"]);
});

test("kana keep their voicing marks and kanji are untouched", () => {
  assert.equal(fold("がま"), "がま");
  assert.equal(fold("が"), "が"); // decomposed が recomposes
  assert.ok(!fold("がま").includes("か"));
  assert.equal(fold("畑中"), "畑中");
});

test("bolds the matched part of the original text", () => {
  assert.deepEqual(highlightParts("Hatanaka Hōzan", "hozan"), [
    { text: "Hatanaka ", match: false },
    { text: "Hōzan", match: true },
  ]);
  assert.deepEqual(highlightParts("HARA Satoshi 原智", "sato 原"), [
    { text: "HARA ", match: false },
    { text: "Sato", match: true },
    { text: "shi ", match: false },
    { text: "原", match: true },
    { text: "智", match: false },
  ]);
  // Decomposed input is shown composed; the mark stays with its letter.
  assert.deepEqual(highlightParts("Hōzan", "ho"), [
    { text: "Hō", match: true },
    { text: "zan", match: false },
  ]);
  assert.deepEqual(highlightParts("Untitled", ""), [{ text: "Untitled", match: false }]);
  assert.deepEqual(highlightParts("", "x"), []);
});

test("a letter whose lower case is longer does not shift the bold", () => {
  // "İ" lower-cases to "i" + U+0307, which folding then drops.
  assert.deepEqual(highlightParts("İzmir Ōta", "ota"), [
    { text: "İzmir ", match: false },
    { text: "Ōta", match: true },
  ]);
});
