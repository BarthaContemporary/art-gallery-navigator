// node --test apps/web/src/lib/london-time.test.ts
// The browser of a visitor abroad: the London clock must not depend on it.
process.env.TZ = "America/Los_Angeles";

import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingTimeProblem, londonNow, londonWall, londonWallToUtc, minutesOf } from "./london-time.ts";

const utc = (iso: string) => Date.parse(iso);

test("London wall clock to instant and back, either side of the clock change", () => {
  assert.equal(new Date(londonWallToUtc("2026-11-02T11:00:00")).toISOString(), "2026-11-02T11:00:00.000Z");
  assert.equal(new Date(londonWallToUtc("2026-07-20T11:00:00")).toISOString(), "2026-07-20T10:00:00.000Z");
  assert.equal(londonWall(utc("2026-07-20T10:00:00Z")), "2026-07-20T11:00:00");
  assert.ok(Number.isNaN(londonWallToUtc("2026-13-01T10:00:00")));
});

test("London's date and time now, whatever the machine's zone", () => {
  // 23:30 UTC on 14 July is 00:30 on 15 July in London (and 16:30 on the 14th in Los Angeles).
  assert.deepEqual(londonNow(new Date(utc("2026-07-14T23:30:00Z"))), { date: "2026-07-15", minutes: 30 });
  assert.deepEqual(londonNow(new Date(utc("2026-11-16T16:05:00Z"))), { date: "2026-11-16", minutes: 16 * 60 + 5 });
  assert.equal(minutesOf("10:30"), 630);
});

test("a time earlier today is refused; a later one is accepted", () => {
  const now = utc("2026-11-14T16:00:00Z"); // Saturday 16:00 in London
  assert.equal(bookingTimeProblem("2026-11-14", "10:00", now), "Please choose a time later than now");
  assert.equal(bookingTimeProblem("2026-11-14", "16:00", now), "Please choose a time later than now");
  assert.equal(bookingTimeProblem("2026-11-14", "16:30", now), null);
  assert.equal(bookingTimeProblem("2026-11-13", "16:30", now), "Please choose a time later than now");
  assert.equal(bookingTimeProblem("2026-11-16", "10:00", now), null);
});

test("a visitor behind London cannot book London's yesterday", () => {
  // 20:00 on Monday in Los Angeles is 04:00 on Tuesday in London.
  const now = utc("2026-11-17T04:00:00Z");
  assert.equal(bookingTimeProblem("2026-11-16", "10:00", now), "Please choose a time later than now");
});

test("dates that do not exist and times the clock change skips are refused", () => {
  const now = utc("2026-01-01T00:00:00Z");
  assert.equal(bookingTimeProblem("2026-02-30", "10:00", now), "Invalid date or time");
  assert.equal(bookingTimeProblem("2026-04-31", "10:00", now), "Invalid date or time");
  // 29 March 2026: London's clocks go from 01:00 to 02:00.
  assert.equal(bookingTimeProblem("2026-03-29", "01:30", now), "Invalid date or time");
  assert.equal(bookingTimeProblem("2026-03-29", "10:00", now), null);
});
