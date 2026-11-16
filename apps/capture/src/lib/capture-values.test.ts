// node --test apps/capture/src/lib/capture-values.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { containsPattern, isBlank, isoDate, MIN_SQUARED_SIDE, parseAmount, planSquare, sanitiseGeo, text } from "./capture-values.ts";

test("search text keeps its dots, commas and brackets; wildcards match themselves", () => {
  assert.equal(containsPattern("Mt. Fuji"), "%Mt. Fuji%");
  assert.equal(containsPattern("Box (lacquer), No. 12"), "%Box (lacquer), No. 12%");
  assert.equal(containsPattern("100%_\\"), "%100\\%\\_\\\\%");
  assert.equal(containsPattern("Lacquer*"), "%Lacquer_%");
});

test("text() reads strings and numbers, nothing else", () => {
  assert.equal(text("  Unno Shōmin "), "Unno Shōmin");
  assert.equal(text(1890), "1890");
  assert.equal(text(1250.5), "1250.5");
  for (const v of [null, undefined, NaN, Infinity, true, {}, ["a"]]) assert.equal(text(v), "");
  assert.equal(isBlank("  "), true);
  assert.equal(isBlank(null), true);
  assert.equal(isBlank(" 0 "), false);
});

test("amounts as typed on a UK or continental phone", () => {
  const cases: [unknown, number | null][] = [
    ["1250", 1250],
    ["1,250", 1250],
    ["1,250.00", 1250],
    ["1,250.50", 1250.5],
    ["1250,50", 1250.5],
    ["1.250,50", 1250.5],
    ["1250,5", 1250.5],
    ["1.25", 1.25],
    ["1.250", 1250],
    ["£1250", 1250],
    ["€ 1.250,00", 1250],
    ["1250 GBP", 1250],
    ["1 250,50", 1250.5],
    ["1'250.50", 1250.5],
    ["1'250.–", 1250],
    ["1,25,000", 125000],
    ["1,25,000.50", 125000.5],
    [".5", 0.5],
    ["0", 0],
    [1250, 1250],
    [1250.5, 1250.5],
  ];
  for (const [raw, want] of cases) assert.equal(parseAmount(raw), want, String(raw));
});

test("amounts that cannot be read without guessing are refused", () => {
  for (const raw of ["", "  ", "abc", "-1250", "1.250.50", "12,50,5", "−20", null, undefined, {}, -5, NaN]) {
    assert.equal(parseAmount(raw), null, String(raw));
  }
});

test("zero-decimal currencies keep every digit", () => {
  assert.equal(parseAmount("¥125,000", "JPY"), 125000);
  assert.equal(parseAmount("125.000", "jpy"), 125000);
  assert.equal(parseAmount("1,250.00", "JPY"), 1250);
  assert.equal(parseAmount("1,250.50", "JPY"), null);
  assert.equal(parseAmount(1250.5, "JPY"), null);
  assert.equal(parseAmount(125000, "JPY"), 125000);
});

test("isoDate() accepts real calendar dates only", () => {
  assert.equal(isoDate("2026-03-18"), "2026-03-18");
  assert.equal(isoDate(" 2026-03-18 "), "2026-03-18");
  for (const v of ["2026-02-30", "18/03/2026", "2026-3-18", "", null, 20260318]) assert.equal(isoDate(v), null, String(v));
});

test("geometry in fractions is kept; pixels, percent and slivers are refused", () => {
  assert.deepEqual(sanitiseGeo({ rotate_deg: 3, crop: { x: 0.05, y: 0.1, w: 0.9, h: 0.8 } }), {
    rotate_deg: 3,
    crop: { x: 0.05, y: 0.1, w: 0.9, h: 0.8 },
  });
  // Numeric strings are read; a missing box is the whole frame; -90 is 270.
  assert.deepEqual(sanitiseGeo({ rotate_deg: "-90", crop: { x: "0", y: "0", w: "1", h: "1" } }), {
    rotate_deg: 270,
    crop: { x: 0, y: 0, w: 1, h: 1 },
  });
  assert.deepEqual(sanitiseGeo({ rotate_deg: 0 }), { rotate_deg: 0, crop: { x: 0, y: 0, w: 1, h: 1 } });
  // A box reaching a hair past the edge is trimmed to it.
  assert.deepEqual(sanitiseGeo({ rotate_deg: 0, crop: { x: 0.1, y: 0, w: 0.91, h: 1 } })?.crop, { x: 0.1, y: 0, w: 0.9, h: 1 });

  for (const g of [
    { rotate_deg: 0, crop: { x: 120, y: 80, w: 2800, h: 3900 } }, // pixels
    { rotate_deg: 0, crop: { x: 5, y: 5, w: 90, h: 90 } }, // percent
    { rotate_deg: 0, crop: { x: 0.1, y: 0.1, w: 0.05, h: 0.9 } }, // sliver
    { rotate_deg: 0, crop: { x: 0.5, y: 0, w: 0.9, h: 1 } }, // well past the edge
    { rotate_deg: "upright", crop: { x: 0, y: 0, w: 1, h: 1 } },
    { rotate_deg: 0, crop: { x: 0, y: 0, w: "wide", h: 1 } },
    { rotate_deg: 0, crop: "full" },
    null,
    "geo",
  ]) {
    assert.equal(sanitiseGeo(g), null, JSON.stringify(g));
  }
});

test("planSquare crops on the photo as shown, then turns the crop upright", () => {
  // A portrait page photographed sideways: crop on the landscape photo, rotate 90.
  const plan = planSquare({ rotate_deg: 90, crop: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 } }, 4000, 3000);
  assert.ok(plan);
  assert.deepEqual([plan.sx, plan.sy, plan.sw, plan.sh], [400, 150, 3200, 2700]);
  assert.deepEqual([plan.outW, plan.outH], [2700, 3200]);
  assert.ok(Math.abs(plan.rad - Math.PI / 2) < 1e-9);

  // Nothing to do: upright and uncropped.
  assert.equal(planSquare({ rotate_deg: 0, crop: { x: 0, y: 0, w: 1, h: 1 } }, 4000, 3000), null);
  // The old 1 × 1 px page: refused instead of produced.
  assert.equal(planSquare({ rotate_deg: 0, crop: { x: 120, y: 80, w: 2800, h: 3900 } }, 4000, 3000), null);
  // Too small a result on a small photo.
  assert.equal(planSquare({ rotate_deg: 0, crop: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } }, 500, 500), null);
  assert.ok((planSquare({ rotate_deg: 2, crop: { x: 0, y: 0, w: 1, h: 1 } }, 4000, 3000)?.outW ?? 0) >= MIN_SQUARED_SIDE);
  assert.equal(planSquare({ rotate_deg: 2 }, 0, 3000), null);
});
