// node --test apps/studio/src/lib/dp-requests.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addOneMonth, londonToday, parseRetentionDays, requestDates, validIsoDay } from "./dp-requests.ts";

test("one month on: the same day of the next month", () => {
  assert.equal(addOneMonth("2026-03-15"), "2026-04-15");
  assert.equal(addOneMonth("2026-01-28"), "2026-02-28");
  assert.equal(addOneMonth("2026-02-28"), "2026-03-28");
});

test("one month on from a month end clamps to the next month's last day", () => {
  assert.equal(addOneMonth("2026-01-29"), "2026-02-28");
  assert.equal(addOneMonth("2026-01-30"), "2026-02-28");
  assert.equal(addOneMonth("2026-01-31"), "2026-02-28");
  assert.equal(addOneMonth("2027-01-31"), "2027-02-28");
  assert.equal(addOneMonth("2026-03-31"), "2026-04-30");
  assert.equal(addOneMonth("2026-05-31"), "2026-06-30");
  assert.equal(addOneMonth("2026-08-31"), "2026-09-30");
  assert.equal(addOneMonth("2026-10-31"), "2026-11-30");
});

test("leap years and the turn of the year", () => {
  assert.equal(addOneMonth("2028-01-31"), "2028-02-29");
  assert.equal(addOneMonth("2028-01-29"), "2028-02-29");
  assert.equal(addOneMonth("2100-01-31"), "2100-02-28");
  assert.equal(addOneMonth("2026-12-31"), "2027-01-31");
  assert.equal(addOneMonth("2026-12-01"), "2027-01-01");
});

test("a day that is not YYYY-MM-DD is refused", () => {
  assert.throws(() => addOneMonth("31/01/2026"));
  assert.equal(validIsoDay("2026-02-30"), null);
  assert.equal(validIsoDay("2026-13-01"), null);
  assert.equal(validIsoDay("yesterday"), null);
  assert.equal(validIsoDay(""), null);
  assert.equal(validIsoDay(null), null);
  assert.equal(validIsoDay("2028-02-29"), "2028-02-29");
});

test("today is the London day, not the UTC one", () => {
  // 00:30 on 10 July in London is still 9 July in UTC.
  assert.equal(londonToday(new Date("2026-07-09T23:30:00Z")), "2026-07-10");
  assert.equal(londonToday(new Date("2026-12-09T23:30:00Z")), "2026-12-09");
});

test("request dates: the posted day, or today in London; due a month later", () => {
  assert.deepEqual(requestDates("2027-01-31"), { received_at: "2027-01-31", due_at: "2027-02-28" });
  assert.deepEqual(requestDates("", new Date("2026-07-09T23:30:00Z")), {
    received_at: "2026-07-10",
    due_at: "2026-08-10",
  });
  assert.deepEqual(requestDates("not a date", new Date("2026-01-31T12:00:00Z")), {
    received_at: "2026-01-31",
    due_at: "2026-02-28",
  });
});

test("a retention period is whole days from 1 to 7300, never a guess", () => {
  assert.equal(parseRetentionDays("2190"), 2190);
  assert.equal(parseRetentionDays(" 30 "), 30);
  assert.equal(parseRetentionDays("1"), 1);
  assert.equal(parseRetentionDays("7300"), 7300);
  for (const bad of ["", "   ", "0", "7301", "30.5", "-5", "abc", "1e3", "12345", null, undefined]) {
    assert.equal(parseRetentionDays(bad), null, String(bad));
  }
});
