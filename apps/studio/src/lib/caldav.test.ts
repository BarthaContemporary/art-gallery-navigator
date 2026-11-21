// node --test apps/studio/src/lib/caldav.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  daysWithin,
  deleteCalendarEvent,
  formEndDay,
  isSingleEvent,
  londonDay,
  londonLocalToUtc,
  londonTime,
  parseIcsDuration,
  parseIcsEvents,
  resolveTzid,
  updateCalendarEvent,
  type CalendarEvent,
} from "./caldav.ts";

const CAL = { href: "/gallery/cal1/", name: "Gallery", color: null };
const RES = { href: "/gallery/cal1/ev.ics", etag: '"1"' };

function ics(...eventLines: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", ...eventLines, "END:VEVENT", "END:VCALENDAR", ""].join(
    "\r\n",
  );
}

function one(text: string): CalendarEvent {
  const events = parseIcsEvents(text, CAL, RES);
  assert.equal(events.length, 1);
  return events[0]!;
}

// --- a stubbed CalDAV server ------------------------------------------------

type Call = { url: string; method: string; body: string | undefined };

async function withServer<T>(
  respond: (call: Call) => Response,
  run: (calls: Call[]) => Promise<T>,
): Promise<T> {
  const env = { url: process.env.CALDAV_URL, user: process.env.CALDAV_USER, pw: process.env.CALDAV_PASSWORD };
  const realFetch = globalThis.fetch;
  process.env.CALDAV_URL = "https://cal.example.test";
  process.env.CALDAV_USER = "gallery";
  process.env.CALDAV_PASSWORD = "secret";
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? "GET", body: init?.body as string | undefined };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    const restore = (k: string, v: string | undefined) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    };
    restore("CALDAV_URL", env.url);
    restore("CALDAV_USER", env.user);
    restore("CALDAV_PASSWORD", env.pw);
  }
}

// --- alarms ------------------------------------------------------------------

const APPLE_WITH_ALARM = ics(
  "UID:visit-1",
  "DTSTAMP:20261001T090000Z",
  "DTSTART;TZID=Europe/London:20261010T140000",
  "DTEND;TZID=Europe/London:20261010T150000",
  "SUMMARY:Client viewing",
  "BEGIN:VALARM",
  "UID:alarm-1",
  "ACTION:DISPLAY",
  "DESCRIPTION:Reminder",
  "TRIGGER:-PT15M",
  "END:VALARM",
);

test("an alarm's DESCRIPTION is not taken as the event's notes", () => {
  const ev = one(APPLE_WITH_ALARM);
  assert.equal(ev.description, null);
  assert.equal(ev.title, "Client viewing");
  assert.equal(ev.uid, "visit-1:20261010T140000");
});

test("an alarm's SUMMARY does not stand in for a missing title", () => {
  const ev = one(
    ics("UID:x", "DTSTART:20261010T090000Z", "BEGIN:VALARM", "ACTION:EMAIL", "SUMMARY:Alarm!", "END:VALARM"),
  );
  assert.equal(ev.title, "(untitled)");
});

test("saving an event with an alarm and no notes adds no event-level DESCRIPTION", async () => {
  await withServer(
    (call) => (call.method === "GET" ? new Response(APPLE_WITH_ALARM, { status: 200 }) : new Response(null, { status: 204 })),
    async (calls) => {
      const res = await updateCalendarEvent("/gallery/cal1/ev.ics", '"1"', {
        title: "Client viewing (moved)",
        location: null,
        description: null,
        allDay: false,
        startDay: "2026-10-10",
        endDay: "2026-10-10",
        startTime: "15:00",
        endTime: "16:00",
      });
      assert.deepEqual(res, { ok: true });
      const put = calls.find((c) => c.method === "PUT");
      assert.ok(put?.body);
      const lines = put.body.split("\r\n");
      assert.deepEqual(
        lines.filter((l) => l.startsWith("DESCRIPTION")),
        ["DESCRIPTION:Reminder"],
      );
      // The alarm's line stays inside the alarm.
      const begin = lines.indexOf("BEGIN:VALARM");
      assert.ok(begin > 0 && lines.indexOf("DESCRIPTION:Reminder") > begin);
    },
  );
});

// --- midnight ends and DURATION ------------------------------------------------

test("an event ending at midnight shows the next day at 00:00 and saves back unchanged", async () => {
  // 18:00 to 00:00 London on Saturday 10 October 2026 (BST).
  const ev = one(ics("UID:dinner", "DTSTART:20261010T170000Z", "DTEND:20261010T230000Z", "SUMMARY:Dinner"));
  assert.equal(ev.endDay, "2026-10-10", "the grid keeps it on its own day");
  assert.equal(formEndDay(ev), "2026-10-11");
  assert.equal(londonTime(ev.end!), "00:00");

  const stored = ics("UID:dinner", "DTSTART:20261010T170000Z", "DTEND:20261010T230000Z", "SUMMARY:Dinner");
  await withServer(
    (call) => (call.method === "GET" ? new Response(stored, { status: 200 }) : new Response(null, { status: 204 })),
    async (calls) => {
      const res = await updateCalendarEvent(ev.href, ev.etag, {
        title: "Dinner with the Tanakas",
        location: null,
        description: null,
        allDay: false,
        startDay: ev.startDay,
        endDay: formEndDay(ev),
        startTime: londonTime(ev.start),
        endTime: londonTime(ev.end!),
      });
      assert.deepEqual(res, { ok: true });
      const body = calls.find((c) => c.method === "PUT")?.body ?? "";
      assert.match(body, /\r\nDTSTART:20261010T170000Z\r\n/);
      assert.match(body, /\r\nDTEND:20261010T230000Z\r\n/);
    },
  );
});

test("an all-day event keeps its inclusive last day in the editor", () => {
  const ev = one(ics("UID:fair", "DTSTART;VALUE=DATE:20261010", "DTEND;VALUE=DATE:20261013", "SUMMARY:Fair"));
  assert.equal(ev.endDay, "2026-10-12");
  assert.equal(formEndDay(ev), "2026-10-12");
});

test("DURATION values parse", () => {
  assert.deepEqual(parseIcsDuration("PT3H"), { days: 0, ms: 3 * 3600_000 });
  assert.deepEqual(parseIcsDuration("P1W"), { days: 7, ms: 0 });
  assert.deepEqual(parseIcsDuration("P2DT1H30M"), { days: 2, ms: 90 * 60_000 });
  assert.deepEqual(parseIcsDuration("-PT15M"), { days: 0, ms: -15 * 60_000 });
  assert.equal(parseIcsDuration("P"), null);
  assert.equal(parseIcsDuration("PT"), null);
  assert.equal(parseIcsDuration("3 hours"), null);
});

test("an event stored with DURATION gets its real end", () => {
  const ev = one(ics("UID:d", "DTSTART;TZID=Europe/London:20261010T140000", "DURATION:PT3H", "SUMMARY:Talk"));
  assert.equal(londonTime(ev.start), "14:00");
  assert.ok(ev.end);
  assert.equal(londonTime(ev.end), "17:00");
  assert.equal(ev.endDay, "2026-10-10");
});

test("a DURATION in days keeps the wall clock across the change of the clocks", () => {
  // Clocks go back on Sunday 25 October 2026.
  const ev = one(ics("UID:d", "DTSTART;TZID=Europe/London:20261024T120000", "DURATION:P1D", "SUMMARY:Loan"));
  assert.equal(ev.end?.toISOString(), "2026-10-25T12:00:00.000Z");
  assert.equal(londonTime(ev.end!), "12:00");
});

test("an all-day event stored with DURATION spans whole days", () => {
  const ev = one(ics("UID:d", "DTSTART;VALUE=DATE:20261010", "DURATION:P3D", "SUMMARY:Fair"));
  assert.equal(ev.startDay, "2026-10-10");
  assert.equal(ev.endDay, "2026-10-12");
});

// --- time-zone names -------------------------------------------------------------

test("Windows, prefixed and unknown TZIDs resolve instead of throwing", () => {
  assert.equal(resolveTzid("Europe/Paris"), "Europe/Paris");
  assert.equal(resolveTzid("GMT Standard Time"), "Europe/London");
  assert.equal(resolveTzid("Tokyo Standard Time"), "Asia/Tokyo");
  assert.equal(resolveTzid("/mozilla.org/20050126_1/America/New_York"), "America/New_York");
  assert.equal(resolveTzid("Atlantis Standard Time"), "Europe/London");
  assert.equal(resolveTzid(undefined), "Europe/London");
});

test("an Outlook event with a Windows zone name parses", () => {
  const ev = one(ics("UID:o", "DTSTART;TZID=GMT Standard Time:20260710T140000", "DTEND;TZID=GMT Standard Time:20260710T150000"));
  assert.equal(ev.start.toISOString(), "2026-07-10T13:00:00.000Z");
  assert.equal(londonDay(ev.start), "2026-07-10");
});

test("an event with an unknown zone name stays in the feed beside the others", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:good",
    "DTSTART:20261010T090000Z",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:bad",
    "DTSTART;TZID=Nowhere/Land:20261010T090000",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const events = parseIcsEvents(text, CAL, RES);
  assert.deepEqual(
    events.map((e) => e.uid.split(":")[0]),
    ["good", "bad"],
  );
});

// --- the href guard ----------------------------------------------------------------

test("delete and update refuse a calendar, the account or a path that normalises upwards", async () => {
  await withServer(
    () => new Response(null, { status: 204 }),
    async (calls) => {
      for (const href of [
        "/gallery/cal1/",
        "/gallery/",
        "/gallery/cal1/.",
        "/gallery/cal1/%2e",
        "/gallery/%2e%2e/%2e%2e",
        "/gallery/cal1/a%2Fb",
        "/gallery/cal1/ev.ics/",
        "/gallery//ev.ics",
        "/other/cal1/ev.ics",
      ]) {
        assert.deepEqual(
          await deleteCalendarEvent(href, null),
          { ok: false, message: "invalid calendar path" },
          href,
        );
        const upd = await updateCalendarEvent(href, null, {
          title: "x",
          location: null,
          description: null,
          allDay: true,
          startDay: "2026-10-10",
          endDay: "2026-10-10",
          startTime: "10:00",
          endTime: "11:00",
        });
        assert.deepEqual(upd, { ok: false, message: "invalid calendar path" }, href);
      }
      assert.equal(calls.length, 0, "nothing reached the server");
    },
  );
});

test("delete goes ahead for an item inside a calendar", async () => {
  await withServer(
    () => new Response(null, { status: 204 }),
    async (calls) => {
      assert.deepEqual(await deleteCalendarEvent("/gallery/cal1/abc@jvb-studio.ics", '"7"'), { ok: true });
      assert.deepEqual(await deleteCalendarEvent("/gallery/cal1/0F3A-21", null), { ok: true });
      assert.deepEqual(
        calls.map((c) => [c.method, c.url]),
        [
          ["DELETE", "https://cal.example.test/gallery/cal1/abc@jvb-studio.ics"],
          ["DELETE", "https://cal.example.test/gallery/cal1/0F3A-21"],
        ],
      );
    },
  );
});

// --- month-grid placement ------------------------------------------------------

test("a long event reaches every month it runs in", () => {
  // 1 September to 15 December; the December grid runs 30 Nov to 3 Jan.
  const december = daysWithin("2026-09-01", "2026-12-15", "2026-11-30", "2027-01-03");
  assert.equal(december[0], "2026-11-30");
  assert.equal(december.at(-1), "2026-12-15");
  assert.equal(december.length, 16);
  // The November grid (26 Oct to 6 Dec) is covered whole.
  assert.equal(daysWithin("2026-09-01", "2026-12-15", "2026-10-26", "2026-12-06").length, 42);
});

test("a short event and an event outside the grid", () => {
  assert.deepEqual(daysWithin("2026-11-10", "2026-11-11", "2026-10-26", "2026-12-06"), ["2026-11-10", "2026-11-11"]);
  assert.deepEqual(daysWithin("2026-08-01", "2026-08-03", "2026-10-26", "2026-12-06"), []);
});

// --- London wall-clock input ---------------------------------------------------

test("a datetime-local value is read as London time", () => {
  assert.equal(londonLocalToUtc("2026-07-10T14:30")?.toISOString(), "2026-07-10T13:30:00.000Z");
  assert.equal(londonLocalToUtc("2026-12-10T14:30")?.toISOString(), "2026-12-10T14:30:00.000Z");
  assert.equal(londonLocalToUtc("2026-07-10T23:30:15")?.toISOString(), "2026-07-10T22:30:15.000Z");
  for (const bad of ["", "2026-07-10", "2026-07-10 14:30", "2026-13-10T14:30", "2026-07-10T25:00", null]) {
    assert.equal(londonLocalToUtc(bad), null, String(bad));
  }
});

// --- timezone blocks are not recurrence ------------------------------------------

/** A timed event as Apple Calendar stores it: a VTIMEZONE beside the event, with its own RRULEs. */
const APPLE_TIMED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Apple Inc.//macOS 15.1//EN",
  "CALSCALE:GREGORIAN",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/London",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "DTSTART:19810329T010000",
  "TZNAME:BST",
  "TZOFFSETTO:+0100",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "DTSTART:19961027T020000",
  "RDATE:19961027T020000",
  "TZNAME:GMT",
  "TZOFFSETTO:+0000",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "CREATED:20261101T090000Z",
  "UID:apple-visit-7",
  "DTEND;TZID=Europe/London:20261120T110000",
  "TRANSP:OPAQUE",
  "SUMMARY:Viewing: Satsuma vase",
  "DTSTART;TZID=Europe/London:20261120T100000",
  "DTSTAMP:20261101T090000Z",
  "SEQUENCE:2",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:Reminder",
  "TRIGGER:-PT30M",
  "END:VALARM",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

const lines = (text: string) => text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/).filter((l) => l !== "");

test("an Apple timed event is a single event: its time zone's RRULE and RDATE are not the event's", () => {
  assert.equal(isSingleEvent(lines(APPLE_TIMED)), true);
  // The feed agrees: shown as editable, not as part of a series.
  assert.equal(one(APPLE_TIMED).recurring, false);
});

test("a series, an override or two events in one resource still count as recurring", () => {
  const withRule = APPLE_TIMED.replace("SEQUENCE:2", "SEQUENCE:2\r\nRRULE:FREQ=WEEKLY;COUNT=4");
  assert.equal(isSingleEvent(lines(withRule)), false);
  const withDates = APPLE_TIMED.replace("SEQUENCE:2", "SEQUENCE:2\r\nRDATE;TZID=Europe/London:20261127T100000");
  assert.equal(isSingleEvent(lines(withDates)), false);
  const override = APPLE_TIMED.replace("SEQUENCE:2", "SEQUENCE:2\r\nRECURRENCE-ID;TZID=Europe/London:20261120T100000");
  assert.equal(isSingleEvent(lines(override)), false);
  const two = APPLE_TIMED.replace("END:VCALENDAR", "BEGIN:VEVENT\r\nUID:x\r\nDTSTART:20261121T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR");
  assert.equal(isSingleEvent(lines(two)), false);
  assert.equal(isSingleEvent(lines("BEGIN:VCALENDAR\r\nEND:VCALENDAR")), false);
});

test("saving an Apple timed event rewrites its time and keeps the time zone block and the alarm", async () => {
  await withServer(
    (call) => (call.method === "GET" ? new Response(APPLE_TIMED, { status: 200 }) : new Response(null, { status: 204 })),
    async (calls) => {
      const res = await updateCalendarEvent("/gallery/cal1/ev.ics", '"7"', {
        title: "Viewing: Satsuma vase",
        location: "Gallery",
        description: null,
        allDay: false,
        startDay: "2026-11-20",
        endDay: "2026-11-20",
        startTime: "11:00",
        endTime: "12:00",
      });
      assert.deepEqual(res, { ok: true });
      const put = calls.find((c) => c.method === "PUT");
      assert.ok(put?.body);
      const out = put.body.split("\r\n");
      // 11:00 London in November is 11:00 UTC.
      assert.ok(out.includes("DTSTART:20261120T110000Z"));
      assert.ok(out.includes("DTEND:20261120T120000Z"));
      assert.ok(!out.some((l) => l.startsWith("DTSTART;TZID")), "the event's old start is gone");
      assert.ok(out.includes("SEQUENCE:3"));
      // The time zone block is left exactly as it was, its own DTSTARTs included.
      const tz = out.slice(out.indexOf("BEGIN:VTIMEZONE"), out.indexOf("END:VTIMEZONE") + 1);
      assert.deepEqual(tz, lines(APPLE_TIMED).slice(lines(APPLE_TIMED).indexOf("BEGIN:VTIMEZONE"), lines(APPLE_TIMED).indexOf("END:VTIMEZONE") + 1));
      assert.ok(out.includes("DESCRIPTION:Reminder"));
    },
  );
});

test("a real series is still refused, and nothing is written", async () => {
  const series = APPLE_TIMED.replace("SEQUENCE:2", "SEQUENCE:2\r\nRRULE:FREQ=WEEKLY;COUNT=4");
  await withServer(
    (call) => (call.method === "GET" ? new Response(series, { status: 200 }) : new Response(null, { status: 204 })),
    async (calls) => {
      const res = await updateCalendarEvent("/gallery/cal1/ev.ics", null, {
        title: "x",
        location: null,
        description: null,
        allDay: false,
        startDay: "2026-11-20",
        endDay: "2026-11-20",
        startTime: "11:00",
        endTime: "12:00",
      });
      assert.deepEqual(res, { ok: false, message: "recurring events are edited in Apple Calendar" });
      assert.equal(calls.filter((c) => c.method === "PUT").length, 0);
    },
  );
});
