// node --test apps/studio/src/lib/fx.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canConvertSale,
  currencyCode,
  currencyOptions,
  derivedRate,
  isIsoDate,
  londonToday,
  rateIsFinal,
  samePence,
  shouldConvertSale,
} from "./fx.ts";

test("only known currency codes are accepted", () => {
  assert.equal(currencyCode("GBP"), "GBP");
  assert.equal(currencyCode(" inr "), "INR");
  assert.equal(currencyCode("HKD"), "HKD");
  // Free text from a legacy import or the capture app stays as stored.
  for (const raw of ["Yen", "YEN", "US$", "Euro", "", "GB", "../../x", null, 3]) {
    assert.equal(currencyCode(raw), null, String(raw));
  }
});

test("the select offers a stored currency outside its list", () => {
  assert.deepEqual(currencyOptions("EUR"), ["GBP", "EUR", "USD", "CHF", "JPY"]);
  assert.deepEqual(currencyOptions("INR"), ["GBP", "EUR", "USD", "CHF", "JPY", "INR"]);
  assert.deepEqual(currencyOptions("Yen"), ["GBP", "EUR", "USD", "CHF", "JPY", "Yen"]);
  assert.deepEqual(currencyOptions(""), ["GBP", "EUR", "USD", "CHF", "JPY"]);
});

test("dates", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-2-3"), false);
  assert.match(londonToday(new Date("2026-06-30T23:30:00Z")), /^2026-07-01$/);
});

test("a rate is cached only once it is final", () => {
  const today = "2026-11-16";
  // Answered for the day asked: final.
  assert.equal(rateIsFinal("2026-11-16", "2026-11-16", today), true);
  // Before the day's fixing the service answers with the day before: not yet.
  assert.equal(rateIsFinal("2026-11-16", "2026-11-13", today), false);
  // A weekend long past is rightly given the Friday before.
  assert.equal(rateIsFinal("2026-11-08", "2026-11-06", today), true);
  assert.equal(rateIsFinal("2026-11-14", "2026-11-13", today), false);
});

test("stored rates keep their precision", () => {
  // ¥500,000 entered as £2,600: 0.0052, not round2's 0.01.
  assert.equal(derivedRate(2600, 500000), 0.0052);
  assert.equal(derivedRate(380, 80000), 0.00475);
  assert.equal(derivedRate(8567, 10000), 0.8567);
  assert.equal(derivedRate(null, 100), null);
  assert.equal(derivedRate(100, 0), null);
  assert.equal(derivedRate(100, null), null);
});

test("pence comparison", () => {
  assert.equal(samePence(10000, 10000.001), true);
  assert.equal(samePence(10000, 10000.01), false);
  assert.equal(samePence(null, null), true);
  assert.equal(samePence(null, 0), false);
});

test("a recorded sale is not converted again by an unrelated edit", () => {
  const today = "2026-11-16";
  const stored = { price: 10000, currency: "USD", date: "2021-03-01", gbp: 7900 };
  // Same inputs (the form posts "10,000", the database 10000): keep £7,900.
  assert.equal(shouldConvertSale({ price: 10000, currency: "usd", date: "2021-03-01" }, stored, today), false);
  // Any of the three inputs changed: convert.
  assert.equal(shouldConvertSale({ price: 10500, currency: "USD", date: "2021-03-01" }, stored, today), true);
  assert.equal(shouldConvertSale({ price: 10000, currency: "EUR", date: "2021-03-01" }, stored, today), true);
  assert.equal(shouldConvertSale({ price: 10000, currency: "USD", date: "2021-03-02" }, stored, today), true);
  // No £ stored yet: convert.
  assert.equal(shouldConvertSale({ price: 10000, currency: "USD", date: "2021-03-01" }, { ...stored, gbp: null }, today), true);
  assert.equal(shouldConvertSale({ price: 10000, currency: "USD", date: "2021-03-01" }, null, today), true);
  // A sale this week may have been converted before its rate was final.
  const recent = { ...stored, date: "2026-11-14" };
  assert.equal(shouldConvertSale({ price: 10000, currency: "USD", date: "2026-11-14" }, recent, today), true);
  // No price: nothing to convert.
  assert.equal(shouldConvertSale({ price: null, currency: "USD", date: null }, stored, today), false);
});

test("whether a conversion is possible at all", () => {
  const today = "2026-11-16";
  assert.equal(canConvertSale({ price: 1, currency: "GBP", date: null }, today), true);
  assert.equal(canConvertSale({ price: 1, currency: "EUR", date: "2026-11-02" }, today), true);
  assert.equal(canConvertSale({ price: 1, currency: "EUR", date: null }, today), false);
  assert.equal(canConvertSale({ price: 1, currency: "EUR", date: "2026-12-01" }, today), false);
  assert.equal(canConvertSale({ price: 1, currency: "Yen", date: "2026-11-02" }, today), false);
});
