// node --test apps/studio/src/lib/fold-text.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the explicit extension; the studio's tsconfig does not allow it.
// @ts-ignore TS5097
import { foldText } from "./fold-text.ts";

const finds = (label: string, typed: string) => foldText(label).includes(foldText(typed.trim()));

test("case and diacritics aside, on both sides", () => {
  assert.ok(finds("Yokota Yōsai", "yosai"));
  assert.ok(finds("Yokota Yosai", "Yōsai"), "a macron typed finds a name stored without one");
  assert.ok(finds("Kobayashi Shōmin (1912–1994)", "SHOMIN"));
  assert.ok(finds("Émile Gallé", "emile galle"));
  assert.ok(!finds("Yokota Yōsai", "yosia"), "folding is not typo tolerance");
});

test("scripts without accents pass through; Hangul is put back together", () => {
  assert.equal(foldText("小林紹民"), "小林紹民");
  assert.equal(foldText("김환기"), "김환기");
  assert.ok(finds("小林紹民 Kobayashi", "紹民"));
  // Kana lose their voicing marks: the forgiving side for a picker.
  assert.ok(finds("がっこう", "かっこう"));
});
