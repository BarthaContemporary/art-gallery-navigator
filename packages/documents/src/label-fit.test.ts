// node --test packages/documents/src/label-fit.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateLines,
  fitLabel,
  isUkCountry,
  LABEL_SIZES,
  labelHyphenation,
  mailingLabelLines,
} from "./label-fit.ts";

const MM = 2.8346;
// Text areas of the three Avery templates (label less 5 mm / 4 mm padding).
const L7160 = { width: (63.5 - 10) * MM, height: (38.1 - 8) * MM };
const L7162 = { width: (99.1 - 10) * MM, height: (33.9 - 8) * MM };
const L7163 = { width: (99.1 - 10) * MM, height: (38.1 - 8) * MM };

test("every usual way of writing the UK counts as domestic", () => {
  for (const c of ["", "  ", undefined, null, "UK", "uk", "U.K.", "U.K", "GB", "G.B.", "United Kingdom", "United Kingdom ", " great britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland"]) {
    assert.ok(isUkCountry(c), String(c));
  }
  for (const c of ["Germany", "Japan", "USA", "Ireland", "Gibraltar"]) assert.ok(!isUkCountry(c), c);
});

test("mailing lines: no country line for the UK, upper-case abroad", () => {
  assert.deepEqual(
    mailingLabelLines({ name: "Jane Smith", lines: ["1 High St"], city: "London", postcode: "SW7 2RL", country: "GB" }),
    ["Jane Smith", "1 High St", "London  SW7 2RL"],
  );
  assert.deepEqual(
    mailingLabelLines({ name: "Dr A", lines: ["Universitätsstraße 100"], city: "Köln", postcode: "50674", country: " Germany " }),
    ["Dr A", "Universitätsstraße 100", "Köln  50674", "GERMANY"],
  );
});

test("an institution without a contact person prints its name once", () => {
  assert.deepEqual(
    mailingLabelLines({ name: "Victoria and Albert Museum", organization: "Victoria and Albert Museum ", lines: ["Cromwell Road"], city: "London", postcode: "SW7 2RL" }),
    ["Victoria and Albert Museum", "Cromwell Road", "London  SW7 2RL"],
  );
  assert.deepEqual(
    mailingLabelLines({ name: "Dr Clare Pollard", organization: "Ashmolean Museum", lines: [] }),
    ["Dr Clare Pollard", "Ashmolean Museum"],
  );
});

test("empty parts take no line", () => {
  assert.deepEqual(mailingLabelLines({ name: "Jane Smith", lines: ["", " ", "1 High St"], city: "", postcode: " " }), [
    "Jane Smith",
    "1 High St",
  ]);
  assert.deepEqual(mailingLabelLines({ name: "Jane", lines: [], postcode: "OX1 2PH" }), ["Jane", "OX1 2PH"]);
});

test("line estimate wraps whole words and breaks only over-long ones", () => {
  assert.equal(estimateLines("", 9.5, L7160.width), 0);
  assert.equal(estimateLines("Beaumont Street", 9.5, L7160.width), 1);
  assert.equal(estimateLines("Ashmolean Museum of Art and Archaeology", 9.5, L7160.width), 2);
  assert.equal(estimateLines("Ashmolean Museum of Art and Archaeology", 9.5, L7163.width), 1);
  assert.ok(estimateLines("x".repeat(80), 9.5, L7160.width) >= 3);
  // Kanji are a full em each.
  assert.equal(estimateLines("茶".repeat(10), 9.5, L7160.width), 1);
  assert.equal(estimateLines("茶".repeat(20), 9.5, L7160.width), 2);
});

test("an ordinary address keeps the normal size on every template", () => {
  const texts = mailingLabelLines({
    name: "Dr Clare Pollard",
    organization: "Ashmolean Museum",
    lines: ["Beaumont Street"],
    city: "Oxford",
    postcode: "OX1 2PH",
  }).map((text) => ({ text, maxLines: 2 }));
  for (const box of [L7160, L7162, L7163]) {
    const fit = fitLabel(texts, box);
    assert.equal(fit.fontSize, 9.5);
    assert.ok(fit.fits);
  }
});

test("a long address steps the size down until it fits, and never past the smallest", () => {
  const long = mailingLabelLines({
    name: "Dr Clare Pollard",
    organization: "Ashmolean Museum of Art and Archaeology",
    lines: ["Department of Eastern Art", "Beaumont Street"],
    city: "Oxford",
    postcode: "OX1 2PH",
    country: "Japan",
  }).map((text) => ({ text, maxLines: 2 }));
  const fit = fitLabel(long, L7162);
  assert.ok(fit.fits);
  assert.ok(fit.fontSize < 9.5);
  // The fitted size really fits: lines × leading within the height.
  const height = long.reduce(
    (h, t) => h + Math.min(estimateLines(t.text, fit.fontSize, L7162.width), 2) * fit.fontSize * fit.leading,
    0,
  );
  assert.ok(height <= L7162.height);

  const absurd = Array.from({ length: 12 }, () => ({ text: "Kensington Court Place, Off Kensington High Street", maxLines: 2 }));
  const worst = fitLabel(absurd, L7162);
  assert.equal(worst.fits, false);
  assert.equal(worst.fontSize, LABEL_SIZES[LABEL_SIZES.length - 1]);
});

test("when the smallest size is not enough, the longest texts give up lines, the addressee last", () => {
  const texts = [
    "The Honourable Alexander Montgomery-Fotheringham OBE",
    "The Fotheringham Collection of Japanese and Indian Art Charitable Trust",
    "Flat 12, Kensington Court Mansions, Kensington Court Place",
    "Off Kensington High Street, Royal Borough of Kensington and Chelsea",
    "London  W8 5BW",
    "UNITED STATES OF AMERICA (CARE OF THE BRITISH EMBASSY)",
  ].map((text) => ({ text, maxLines: 2 }));
  const fit = fitLabel(texts, L7160);
  assert.ok(fit.fits);
  assert.equal(fit.fontSize, LABEL_SIZES[LABEL_SIZES.length - 1]);
  assert.equal(fit.maxLines[0], 2, "the addressee keeps its lines");
  const height = texts.reduce(
    (h, t, i) => h + Math.min(estimateLines(t.text, fit.fontSize, L7160.width), fit.maxLines[i]!) * fit.fontSize * fit.leading,
    0,
  );
  assert.ok(height <= L7160.height);
});

test("labels never hyphenate ordinary words; only over-long ones get break points", () => {
  assert.deepEqual(labelHyphenation("Archaeology"), ["Archaeology"]);
  assert.deepEqual(labelHyphenation("Universitätsstraße"), ["Universitätsstraße"]);
  assert.deepEqual(labelHyphenation("Montgomery-Fotheringham"), ["Montgomery-Fotheringham"]);
  assert.deepEqual(labelHyphenation("京都市東山区"), ["京都市東山区"]);
  for (const word of ["Supercalifragilisticexpialidociously", "京都市東山区祇園町北側三丁目百二十三番地"]) {
    const parts = labelHyphenation(word);
    assert.ok(parts.length > 1, word);
    assert.equal(parts.join(""), word);
  }
});

test("a whole word too wide for the line at a size makes the label use a smaller one", () => {
  const word = "MONTGOMERY-FOTHERINGHAMSHIRE"; // 28 characters, kept whole
  assert.equal(estimateLines(word, 9.5, L7160.width), Infinity);
  const fit = fitLabel([{ text: "Jane Smith" }, { text: word }], L7160);
  assert.ok(fit.fits);
  assert.ok(fit.fontSize < 9.5);
  assert.ok(Number.isFinite(estimateLines(word, fit.fontSize, L7160.width)));
});
