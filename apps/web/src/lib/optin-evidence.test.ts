// node --test apps/web/src/lib/optin-evidence.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmTokenHash,
  expiredPendingPatch,
  linkExpired,
  pendingPatch,
  settleSignUpPatch,
  type OptInContact,
} from "./optin-evidence.ts";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const TOKEN = "a".repeat(48);
const NEW_TOKEN = "b".repeat(48);

const contact = (over: Partial<OptInContact>): OptInContact => ({
  id: "c1",
  marketing_consent: false,
  unsubscribed_at: null,
  do_not_mail: false,
  consent_evidence: {},
  consent_confirm_token: null,
  consent_confirm_sent_at: null,
  ...over,
});

const request = (at: string) => ({
  version: "2026-10",
  form: "newsletter" as const,
  text: "I would like to receive the gallery's newsletter…",
  at,
  ip_hash: "ip",
  user_agent: "ua",
  page: "https://example.com/",
});

test("a link works for 30 days, and a request with no time counts as expired", () => {
  assert.equal(linkExpired(daysAgo(29), NOW), false);
  assert.equal(linkExpired(daysAgo(31), NOW), true);
  assert.equal(linkExpired(null, NOW), true);
  assert.equal(linkExpired("not a date", NOW), true);
});

test("a lapsed pending request is dropped when a form has nothing new to ask", () => {
  const lapsed = contact({
    consent_evidence: { contact: { form: "enquiry" }, marketing_pending: { form: "enquiry_mailing_list", at: daysAgo(40), ip_hash: "x" } },
  });
  assert.deepEqual(expiredPendingPatch(lapsed, NOW), { consent_evidence: { contact: { form: "enquiry" } } });
  assert.deepEqual(settleSignUpPatch(lapsed, NOW), { consent_evidence: { contact: { form: "enquiry" } } });

  const live = contact({ consent_evidence: { marketing_pending: { at: daysAgo(3), token_hash: "h" } } });
  assert.equal(expiredPendingPatch(live, NOW), null);
  assert.equal(settleSignUpPatch(live, NOW), null);
  assert.equal(settleSignUpPatch(contact({}), NOW), null);
});

test("a sign-up that books or enquires moves its live request out of the column", () => {
  const signUp = contact({
    consent_confirm_token: TOKEN,
    consent_confirm_sent_at: daysAgo(5),
    consent_evidence: { marketing: request(daysAgo(5)) },
  });
  const patch = settleSignUpPatch(signUp, NOW)!;
  assert.equal(patch.consent_confirm_token, null);
  assert.equal(patch.consent_confirm_sent_at, null);
  const evidence = patch.consent_evidence as Record<string, Record<string, unknown>>;
  assert.equal(evidence.marketing, undefined, "the unconfirmed request no longer stands as the consent record");
  assert.equal(evidence.marketing_pending.token_hash, confirmTokenHash(TOKEN));
  assert.equal(evidence.marketing_pending.ip_hash, "ip");
  assert.equal(evidence.marketing_pending.at, daysAgo(5));
});

test("a sign-up whose link has already expired loses the request instead of keeping it", () => {
  const signUp = contact({
    consent_confirm_token: TOKEN,
    consent_confirm_sent_at: daysAgo(400),
    consent_evidence: { contact: { form: "booking" }, marketing: request(daysAgo(400)) },
  });
  assert.deepEqual(settleSignUpPatch(signUp, NOW), {
    consent_confirm_token: null,
    consent_confirm_sent_at: null,
    consent_evidence: { contact: { form: "booking" } },
  });
});

test("a confirmed or imported consent record is never moved", () => {
  const confirmed = { form: "newsletter", at: daysAgo(900), confirmed_at: daysAgo(899) };
  const signUp = contact({
    consent_confirm_token: TOKEN,
    consent_confirm_sent_at: daysAgo(2),
    consent_evidence: { marketing: confirmed },
  });
  const evidence = settleSignUpPatch(signUp, NOW)!.consent_evidence as Record<string, unknown>;
  assert.deepEqual(evidence.marketing, confirmed);
  assert.equal((evidence.marketing_pending as Record<string, unknown>).at, daysAgo(2));
});

test("a new request for an existing contact replaces the pending entry and clears the column", () => {
  const existing = contact({
    consent_confirm_token: TOKEN,
    consent_confirm_sent_at: daysAgo(10),
    consent_evidence: { contact: { form: "enquiry" }, marketing: request(daysAgo(10)) },
  });
  const ev = request(new Date(NOW).toISOString());
  const patch = pendingPatch(existing, NEW_TOKEN, ev, new Date(NOW).toISOString(), { fromSignUpBox: false });
  assert.equal(patch.consent_confirm_token, null);
  const evidence = patch.consent_evidence as Record<string, Record<string, unknown>>;
  assert.equal(evidence.marketing, undefined);
  assert.deepEqual(evidence.contact, { form: "enquiry" });
  assert.equal(evidence.marketing_pending.token_hash, confirmTokenHash(NEW_TOKEN));
});

test("the newsletter box asking again for its own sign-up keeps the token in the column, dropping a lapsed entry", () => {
  const own = contact({
    consent_confirm_token: TOKEN,
    consent_confirm_sent_at: daysAgo(10),
    consent_evidence: { marketing: request(daysAgo(10)), marketing_pending: { at: daysAgo(45), token_hash: "old" } },
  });
  const now = new Date(NOW).toISOString();
  const ev = request(now);
  assert.deepEqual(pendingPatch(own, NEW_TOKEN, ev, now, { fromSignUpBox: true }), {
    consent_confirm_token: NEW_TOKEN,
    consent_confirm_sent_at: now,
    consent_evidence: { marketing: ev },
  });
});
