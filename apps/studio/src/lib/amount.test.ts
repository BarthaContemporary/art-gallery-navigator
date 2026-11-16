// node --test apps/studio/src/lib/amount.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseAmount, parseAmount, readAmount } from "./amount.ts";

test("UK amounts keep their meaning", () => {
  const cases: [string, number][] = [
    ["1200", 1200],
    ["1,200", 1200],
    ["1,200.50", 1200.5],
    ["£1,200.50", 1200.5],
    ["12,500 GBP", 12500],
    ["1,200,000", 1200000],
    ["1 200", 1200],
    ["1 200", 1200],
    ["$10,000", 10000],
    ["¥500,000", 500000],
    [".5", 0.5],
    ["1200.", 1200],
    ["-5", -5],
    ["12.5 cm", 12.5],
    // Indian grouping: the last group has three digits, so these are thousands.
    ["1,20,000", 120000],
    ["12,34,567.50", 1234567.5],
  ];
  for (const [raw, want] of cases) assert.equal(parseAmount(raw), want, raw);
});

test("a final comma before one or two digits is a decimal comma", () => {
  const cases: [string, number][] = [
    ["1250,50", 1250.5],
    ["12,5", 12.5],
    ["0,5", 0.5],
    ["1.200,50", 1200.5],
    ["12.500,00 €", 12500],
    ["1 200,00 €", 1200],
    ["1 234 567,89", 1234567.89],
  ];
  for (const [raw, want] of cases) assert.equal(parseAmount(raw), want, raw);
});

test("dots grouping threes with no decimal part are thousands", () => {
  assert.equal(parseAmount("1.200.000"), 1200000);
  // One dot stays the decimal point (UK usage).
  assert.equal(parseAmount("12.500"), 12.5);
});

test("forms that are not an amount are refused, not misread", () => {
  for (const raw of ["1e5", "1E-3", "0x10", "(150)", "10x20", "abc", "5-", "--5", "1.2.3"]) {
    assert.equal(parseAmount(raw), null, raw);
    assert.equal(readAmount(raw).invalid, true, raw);
    assert.equal(normaliseAmount(raw), "", raw);
  }
});

test("an empty field is empty, not invalid", () => {
  for (const raw of ["", "   ", null, undefined]) {
    assert.deepEqual(readAmount(raw), { value: null, invalid: false });
  }
  assert.deepEqual(readAmount(42), { value: 42, invalid: false });
  assert.deepEqual(readAmount(Number.NaN), { value: null, invalid: true });
});

test("the money field's own formatting reads back to the same number", () => {
  for (const n of [1250.5, 12500, 125, 0.05, 1234567.89]) {
    const shown = n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    assert.equal(parseAmount(shown), n, shown);
  }
});
