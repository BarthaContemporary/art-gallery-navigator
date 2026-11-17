// node --test apps/studio/src/lib/contact-save.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { changedFlags, consentStamp, mergeInterests, parseNames } from "./contact-save.ts";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

test("an untouched consent box is not written over what the website set", () => {
  // Rendered unticked; the person has since confirmed by email (true in the
  // database); staff add a note in the tab opened earlier.
  const fd = form({ notes: "Called", marketing_consent_was: "", do_not_mail_was: "", kyc_status: "not_started", kyc_status_was: "not_started" });
  assert.deepEqual(changedFlags(fd), {});
});

test("a box the user changed is written, either way", () => {
  assert.deepEqual(changedFlags(form({ marketing_consent: "on", marketing_consent_was: "", do_not_mail_was: "" })), {
    marketing_consent: true,
    kyc_status: "not_started",
  });
  const unticked = changedFlags(form({ marketing_consent_was: "on", do_not_mail_was: "on", kyc_status: "confirmed", kyc_status_was: "confirmed" }));
  assert.deepEqual(unticked, { marketing_consent: false, do_not_mail: false });
});

test("a hard bounce's do-not-mail survives a stale tab", () => {
  const fd = form({ do_not_mail_was: "", marketing_consent_was: "on", marketing_consent: "on", kyc_status: "pending", kyc_status_was: "pending" });
  assert.equal("do_not_mail" in changedFlags(fd), false);
});

test("the AML status is written only when changed", () => {
  assert.deepEqual(changedFlags(form({ kyc_status: "confirmed", kyc_status_was: "pending", marketing_consent_was: "", do_not_mail_was: "" })), {
    kyc_status: "confirmed",
  });
  // An empty status reads as not started, on both sides.
  assert.deepEqual(changedFlags(form({ kyc_status: "", kyc_status_was: "not_started", marketing_consent_was: "", do_not_mail_was: "" })), {});
});

test("an editor without the _was keys writes every flag, as before", () => {
  assert.deepEqual(changedFlags(form({ kyc_status: "pending" })), {
    marketing_consent: false,
    do_not_mail: false,
    kyc_status: "pending",
  });
});

test("interests merge this tab's additions and removals into what is stored", () => {
  // A sale added "Bronzes" since the tab opened; staff add "Lacquer" and
  // remove "Mingei" here.
  const stored = ["Mingei", "Netsuke", "Bronzes"];
  const was = ["Mingei", "Netsuke"];
  const posted = ["Netsuke", "Lacquer"];
  assert.deepEqual(mergeInterests(stored, posted, was), ["Netsuke", "Bronzes", "Lacquer"]);
  // Nothing changed here: the stored list stands, the sale's addition kept.
  assert.deepEqual(mergeInterests(stored, was, was), stored);
  // An older editor (no interests_was): the posted list, as before.
  assert.deepEqual(mergeInterests(stored, posted, null), posted);
  // Garbage stored is read as none.
  assert.deepEqual(mergeInterests({ x: 1 }, ["A"], []), ["A"]);
  assert.deepEqual(mergeInterests(stored, [...posted, "Lacquer"], was).filter((n) => n === "Lacquer").length, 1);
});

test("parseNames reads a JSON list and refuses anything else", () => {
  assert.deepEqual(parseNames('["a", "b", ""]'), ["a", "b"]);
  assert.equal(parseNames(null), null);
  assert.equal(parseNames("not json"), null);
  assert.equal(parseNames('{"a":1}'), null);
});

test("consent is stamped once, on the first grant, and never re-dated", () => {
  const now = "2026-11-16T10:00:00.000Z";
  const fresh = { marketing_consent: false, consent_date: null, consent_source: null };
  assert.deepEqual(consentStamp(fresh, true, "staff@gallery", now), {
    consent_date: now,
    consent_source: "Recorded in the studio by staff@gallery",
  });
  // Already consenting: nothing re-dated (this is why a failed read must not
  // stand in for the row).
  const consenting = { marketing_consent: true, consent_date: "2025-01-01T00:00:00Z", consent_source: "Website form" };
  assert.deepEqual(consentStamp(consenting, true, "staff@gallery", now), {});
  // Re-granted after a withdrawal: the original evidence is kept.
  const withdrawn = { ...consenting, marketing_consent: false };
  assert.deepEqual(consentStamp(withdrawn, true, "staff@gallery", now), {
    consent_date: "2025-01-01T00:00:00Z",
    consent_source: "Website form",
  });
  // Not written (unchanged) or withdrawn: no stamp.
  assert.deepEqual(consentStamp(fresh, undefined, "x", now), {});
  assert.deepEqual(consentStamp(fresh, false, "x", now), {});
});
