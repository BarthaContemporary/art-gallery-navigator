// node --test tooling/migration/src/lib/values.test.ts
// (TZ=Europe/London makes the old bugs show: the result must not depend on it.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { toGbp } from "./currency.ts";
import { parseDimensionsFromText } from "./dimensions.ts";
import { extractMaker } from "./maker.ts";
import { normalizeStockNumber } from "./stock.ts";
import { excelSerialToIso, toIsoDate, toYear } from "./values.ts";

test("dates: ISO, day-first British, two-digit years and Excel serials", () => {
  assert.equal(toIsoDate("2015-06-12"), "2015-06-12");
  assert.equal(toIsoDate("2015-06-12T00:00:00.000Z"), "2015-06-12");
  assert.equal(toIsoDate("05/03/2019"), "2019-03-05"); // 5 March, not 3 May
  assert.equal(toIsoDate("5-3-2019"), "2019-03-05");
  assert.equal(toIsoDate("05.03.19"), "2019-03-05");
  assert.equal(toIsoDate("1/2/87"), "1987-02-01");
  assert.equal(toIsoDate(43529), "2019-03-05");
  assert.equal(toIsoDate("43529"), "2019-03-05");
  assert.equal(excelSerialToIso(7306), "1920-01-01");
  assert.equal(excelSerialToIso(1), null);
});

test("dates: anything else is no date, never a guess", () => {
  for (const bad of ["12 Jun 2015", "June 2015", "31/02/2020", "13/13/2013", "2020-02-30", "c. 1990", "?", "", null, 3]) {
    assert.equal(toIsoDate(bad), null, String(bad));
  }
  assert.equal(toYear("June 2015"), null);
  assert.equal(toYear("05/03/2019"), 2019);
});

test("GBP: foreign amounts without a real rate stay unconverted", () => {
  assert.equal(toGbp(500_000, 1, "JPY"), null); // stale rate 1: 0066's bug
  assert.equal(toGbp(500_000, 0, "JPY"), null);
  assert.equal(toGbp(500_000, -0.005, "JPY"), null);
  assert.equal(toGbp(500_000, null, "JPY"), null);
  assert.equal(toGbp(500_000, 0.0052, "JPY"), 2600);
  assert.equal(toGbp(1200, null, "GBP"), 1200);
  assert.equal(toGbp(1200, 1, "GBP"), 1200);
  assert.equal(toGbp(1200, null, null), 1200);
  assert.equal(toGbp(null, 0.5, "EUR"), null);
});

test("dimensions: a number in inches is never read as centimetres", () => {
  assert.deepEqual(parseDimensionsFromText("H 9 in (23 cm)").values, {});
  assert.deepEqual(parseDimensionsFromText('H 9" (23 cm)').values, {});
  assert.deepEqual(parseDimensionsFromText("H: 23.5 x W: 22 cm, 9 x 8 in").values, { height_cm: 23.5, width_cm: 22 });
  assert.deepEqual(parseDimensionsFromText("H 23.5 × W 22 × D 4 cm").values, {
    height_cm: 23.5,
    width_cm: 22,
    depth_cm: 4,
  });
  assert.deepEqual(parseDimensionsFromText("Height: 15.5 cm, 5 ¾ in").values, { height_cm: 15.5 });
});

test("makers: names with life dates, but no periods or attributions", () => {
  assert.equal(extractMaker("Yoneda Bishō (1929-2008)\nHeight: 15.5 cm", null)?.proposed_maker, "Yoneda Bishō");
  assert.equal(extractMaker("Kano Natsuo (b. 1828)", null)?.proposed_maker, "Kano Natsuo");
  for (const line of [
    "Bronze vase, Meiji period (1868-1912)",
    "Edo period (1603–1868)",
    "Attributed to Hokusai (1760–1849)",
    "School of Kano Tan'yū (1602-1674)",
    "After Hiroshige (1797-1858)",
    "Mughal dynasty (1526-1857)",
  ]) {
    assert.equal(extractMaker(line, null), null, line);
  }
});

test("stock numbers: numbers keep their value, '.0' strings lose the decimal", () => {
  assert.equal(normalizeStockNumber(123), "123");
  assert.equal(normalizeStockNumber(12.5), "12.5");
  assert.equal(normalizeStockNumber("123.0"), "123");
  assert.equal(normalizeStockNumber("  "), null);
});
