// node --test apps/web/src/lib/events.test.ts
// Runs in New York time on purpose: EventTile computes the year in the
// visitor's browser, and a zone west of Greenwich is where it went wrong.
process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import { eventDates, eventStatus, eventYear, standNumber } from "./events.ts";

test("a stand typed with the word Stand is printed once", () => {
  assert.equal(standNumber("262"), "262");
  assert.equal(standNumber("Stand 262"), "262");
  assert.equal(standNumber("  stand B03 "), "B03");
  assert.equal(standNumber("Standard booth"), "Standard booth");
  assert.equal(standNumber(""), null);
  assert.equal(standNumber(null), null);
});

test("a 1 January date is filed under its own year west of Greenwich", () => {
  assert.equal(new Date("2026-01-01").getFullYear(), 2025, "the zone really is behind UTC");
  assert.equal(eventYear({ startDate: "2026-01-01", endDate: null }), "2026");
  assert.equal(eventYear({ startDate: "2025-11-10", endDate: "2026-01-01" }), "2026");
  assert.equal(eventYear({ startDate: null, endDate: null }), null);
  assert.equal(eventYear({ startDate: "not a date", endDate: null }), null);
});

test("status and dates for valid data are unchanged", () => {
  const now = new Date(2026, 10, 14, 12);
  assert.equal(eventStatus({ startDate: "2026-11-10", endDate: "2026-11-30" }, now), "current");
  assert.equal(eventStatus({ startDate: "2026-12-01", endDate: "2026-12-10" }, now), "forthcoming");
  assert.equal(eventStatus({ startDate: "2026-10-01", endDate: "2026-10-10" }, now), "past");
  assert.equal(eventStatus({ startDate: null, endDate: null }, now), "past");
  assert.equal(eventDates("2026-11-10", "2026-11-30"), "10 November – 30 November 2026");
  assert.equal(eventDates("2026-03-03", "2026-04-12"), "3 March – 12 April 2026");
  assert.equal(eventDates("2025-12-01", "2026-01-01"), "1 December 2025 – 1 January 2026");
  assert.equal(eventDates("2026-03-03", "2026-04-12", "month"), "March – April 2026");
  assert.equal(eventDates("2026-03-01", "2026-03-31", "month"), "March 2026");
  assert.equal(eventDates(null, null), null);
});

test("month precision runs to the end of the closing month", () => {
  const now = new Date(Date.UTC(2026, 3, 30, 12));
  assert.equal(eventStatus({ startDate: "2026-03-01", endDate: "2026-04-01", datePrecision: "month" }, now), "current");
  assert.equal(eventStatus({ startDate: "2026-03-01", endDate: "2026-03-01", datePrecision: "month" }, now), "past");
});

test("today is the London day, not the machine's or UTC's", () => {
  // 23:30 UTC on 14 July is 00:30 on 15 July in London: the show that closed on the 14th is over.
  const lateUtc = new Date(Date.UTC(2026, 6, 14, 23, 30));
  assert.equal(eventStatus({ startDate: "2026-07-01", endDate: "2026-07-14" }, lateUtc), "past");
  assert.equal(eventStatus({ startDate: "2026-07-15", endDate: "2026-07-20" }, lateUtc), "current");
});
