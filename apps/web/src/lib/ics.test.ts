// node --test apps/web/src/lib/ics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "./ics.ts";

const event = {
  uid: "u1@jvb-booking",
  start: "2026-11-02T11:00:00",
  end: "2026-11-02T12:00:00",
  summary: "Private gallery viewing — Gallery",
};

/** The calendar's lines with folding undone (RFC 5545 §3.1). */
const unfolded = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

test("every line break in text stays inside its property, a lone CR included", () => {
  const ics = buildIcs({ ...event, description: "one\rATTENDEE:mailto:x@example.com\ntwo\r\nthree" });
  const lines = unfolded(ics);
  assert.ok(lines.includes("DESCRIPTION:one\\nATTENDEE:mailto:x@example.com\\ntwo\\nthree"));
  assert.ok(!lines.some((l) => l.startsWith("ATTENDEE")));
  assert.ok(!/\r(?!\n)/.test(ics), "no bare CR in the file");
  assert.ok(!/(?<!\r)\n/.test(ics), "no bare LF in the file");
});

test("control characters are dropped and TEXT specials escaped", () => {
  const lines = unfolded(buildIcs({ ...event, description: "a\u0000b\u000bc; d, e\\f\tg" }));
  assert.ok(lines.includes("DESCRIPTION:abc\\; d\\, e\\\\f\tg"));
});

test("names are quoted parameter values and can be left out", () => {
  const named = unfolded(
    buildIcs({
      ...event,
      organizer: { name: "Gallery; Ltd", email: "info@example.com" },
      attendee: { name: 'Jane "J" Smith: x', email: "jane@example.com" },
    }),
  );
  assert.ok(named.includes('ORGANIZER;CN="Gallery; Ltd":mailto:info@example.com'));
  assert.ok(named.includes('ATTENDEE;CN="Jane J Smith: x";ROLE=REQ-PARTICIPANT:mailto:jane@example.com'));

  const anonymous = unfolded(buildIcs({ ...event, attendee: { name: null, email: "jane@example.com" } }));
  assert.ok(anonymous.includes("ATTENDEE;ROLE=REQ-PARTICIPANT:mailto:jane@example.com"));
});
