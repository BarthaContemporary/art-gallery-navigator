// node --test apps/capture/src/lib/contact-rules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { CAPTURE_CONTACT_UNDO_HOURS, contactDeleteRefusal, deleteFailure, holdRefusal } from "./contact-rules.ts";

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

test("a delete the database refuses with 23503 is a 409 with its reason; other errors stay 500", () => {
  // 0097's guard: a hold that appeared after the check.
  const held = deleteFailure({
    code: "23503",
    message: "This contact cannot be deleted: Sales on record (HMRC, six years)",
  });
  assert.equal(held.status, 409);
  assert.match(held.error, /^This contact cannot be deleted: Sales on record \(HMRC, six years\)\. /);
  assert.match(held.error, /studio/);
  // A plain foreign key: no table names in the message shown on the phone.
  const fk = deleteFailure({
    code: "23503",
    message: 'update or delete on table "crm_contacts" violates foreign key constraint "x" on table "y"',
  });
  assert.equal(fk.status, 409);
  assert.doesNotMatch(fk.error, /violates|crm_contacts/);
  assert.match(fk.error, /studio/);
  assert.deepEqual(deleteFailure({ code: "57014", message: "canceling statement due to statement timeout" }), {
    status: 500,
    error: "canceling statement due to statement timeout",
  });
  assert.equal(deleteFailure({ message: "" }).status, 500);
});

test("the contact route maps its final delete through deleteFailure", () => {
  const route = readFileSync(new URL("../app/api/capture/contact/[id]/route.ts", import.meta.url), "utf8");
  assert.match(route, /const failed = deleteFailure\(error\);/);
  assert.doesNotMatch(route, /delete\(\)\.eq\("id", id\);\n\s+if \(error\) return NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\)/);
});
