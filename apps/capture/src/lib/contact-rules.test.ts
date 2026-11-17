// node --test apps/capture/src/lib/contact-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { CAPTURE_CONTACT_UNDO_HOURS, contactDeleteRefusal, holdRefusal } from "./contact-rules.ts";

const now = Date.parse("2026-11-16T12:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

test("only the app's own, recent contacts may be deleted from capture", () => {
  assert.equal(contactDeleteRefusal({ tags: ["capture"], created_at: hoursAgo(1) }, now), null);
  assert.equal(contactDeleteRefusal({ tags: ["capture", "fair"], created_at: hoursAgo(CAPTURE_CONTACT_UNDO_HOURS - 1) }, now), null);
  assert.equal(contactDeleteRefusal({ tags: ["collector"], created_at: hoursAgo(1) }, now)?.status, 403);
  assert.equal(contactDeleteRefusal({ tags: null, created_at: hoursAgo(1) }, now)?.status, 403);
  // Two months later, when a sale and AML checks may exist: the studio's job.
  const old = contactDeleteRefusal({ tags: ["capture"], created_at: hoursAgo(24 * 60) }, now);
  assert.equal(old?.status, 409);
  assert.match(old?.error ?? "", /studio/);
  assert.equal(contactDeleteRefusal({ tags: ["capture"], created_at: "garbage" }, now)?.status, 409);
  assert.equal(contactDeleteRefusal({ tags: ["capture"] }, now)?.status, 409);
});

test("any legal hold refuses, and a failed check never deletes", () => {
  assert.equal(holdRefusal([], false), null);
  const held = holdRefusal(["Anti-money-laundering due diligence (MLR 2017, five years after the relationship ends)"], false);
  assert.equal(held?.status, 409);
  assert.deepEqual(held?.holds, ["Anti-money-laundering due diligence (MLR 2017, five years after the relationship ends)"]);
  assert.match(held?.error ?? "", /Anti-money-laundering/);
  assert.equal(holdRefusal(null, true)?.status, 500);
  assert.equal(holdRefusal(null, false)?.status, 500);
  assert.equal(holdRefusal("x", false)?.status, 500);
});
