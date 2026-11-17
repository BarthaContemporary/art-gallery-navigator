// node --test apps/web/src/lib/resend-event.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { planResendEvent } from "./resend-event.ts";

const at = "2026-11-16T10:00:00.000Z";

test("a spam complaint withdraws consent and stops mail", () => {
  const plan = planResendEvent({ type: "email.complained", created_at: at, data: { email_id: "e1" } });
  assert.deepEqual(plan.suppression, { marketing_consent: false, unsubscribed_at: at, do_not_mail: true });
  assert.deepEqual(plan.recipientPatch, { bounced_at: at, status: "bounced" });
});

test("a hard bounce stops mail; a soft one only marks the recipient", () => {
  const hard = planResendEvent({ type: "email.bounced", created_at: at, data: { email_id: "e1", bounce: { type: "Permanent" } } });
  assert.deepEqual(hard.suppression, { email_bounced_at: at, do_not_mail: true });
  const soft = planResendEvent({ type: "email.bounced", created_at: at, data: { email_id: "e1", bounce: { type: "Transient" } } });
  assert.equal(soft.suppression, null);
  assert.deepEqual(soft.recipientPatch, { bounced_at: at, status: "bounced" });
});

test("opens and clicks touch the campaign recipient only", () => {
  const opened = planResendEvent({ type: "email.opened", created_at: at });
  assert.deepEqual(opened.recipientPatch, { opened_at: at, status: "opened" });
  assert.equal(opened.suppression, null);
  assert.deepEqual(planResendEvent({ type: "email.clicked", created_at: at }).recipientPatch, { clicked_at: at, status: "clicked" });
});

test("a redelivered event writes the same time; unknown events change nothing", () => {
  const a = planResendEvent({ type: "email.opened", created_at: at }, new Date("2026-11-17T00:00:00Z"));
  assert.equal(a.at, at);
  const other = planResendEvent({ type: "email.delivered", created_at: at });
  assert.equal(other.recipientPatch, null);
  assert.equal(other.suppression, null);
  assert.equal(planResendEvent({}, new Date(at)).at, at);
});
