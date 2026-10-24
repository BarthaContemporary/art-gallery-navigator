// node --test apps/studio/src/lib/calendar-access.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { canUseCalendar } from "./calendar-access.ts";

test("admin and staff use the shared calendar", () => {
  assert.equal(canUseCalendar(["admin"]), true);
  assert.equal(canUseCalendar(["staff"]), true);
  assert.equal(canUseCalendar(["accountant", "staff"]), true);
});

test("the accountant and a user with no role do not", () => {
  assert.equal(canUseCalendar(["accountant"]), false);
  assert.equal(canUseCalendar([]), false);
});
