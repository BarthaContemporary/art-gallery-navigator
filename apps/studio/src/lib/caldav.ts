// Read-only CalDAV client for the shared company calendar (Radicale on the
// VPS, see infra/README.md §6h). Server-side only — the `gallery` credentials
// must never reach the browser. Leave the CALDAV_* env vars unset to hide the
// calendar view (the appointments page degrades gracefully).
//
// Radicale ≥3.2 expands recurring events server-side (RFC 4791 `expand`), so
// this client never has to evaluate RRULEs; if an older server rejects the
// expand element we retry without it and recurring events appear only on
// their first occurrence.

const LONDON = "Europe/London";

export type CalDavCalendar = {
  href: string;
  name: string;
  color: string | null;
};

export type CalendarEvent = {
  uid: string;
  title: string;
  location: string | null;
  description: string | null;
  allDay: boolean;
  start: Date;
  end: Date | null;
  /** Inclusive YYYY-MM-DD day span in Europe/London, for grid placement. */
  startDay: string;
  endDay: string;
  calendarName: string;
  color: string | null;
  /** CalDAV resource path — the PUT/DELETE target for edits. */
  href: string;
  etag: string | null;
  /** Recurring events are edited in Apple Calendar, not the studio. */
  recurring: boolean;
};

export type CalendarFeed =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ok"; calendars: CalDavCalendar[]; events: CalendarEvent[] };

function config() {
  const url = process.env.CALDAV_URL?.replace(/\/+$/, "");
  const user = process.env.CALDAV_USER;
  const password = process.env.CALDAV_PASSWORD;
  if (!url || !user || !password) return null;
  return { url, user, password };
}

export function calendarConfigured(): boolean {
  return config() !== null;
}

/** Radicale's built-in web UI — for the "open full calendar" link. */
export function calendarWebUrl(): string | null {
  const cfg = config();
  return cfg ? `${cfg.url}/.web/` : null;
}

// --- tiny namespace-agnostic XML helpers (Radicale's multistatus output) ----

function xmlBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[A-Za-z0-9_-]+:)?${tag}>`,
    "g",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1] ?? "");
  return out;
}

function xmlText(xml: string, tag: string): string | null {
  const first = xmlBlocks(xml, tag)[0];
  return first === undefined ? null : unescapeXml(first).trim();
}

function unescapeXml(s: string): string {
  return s
    .replace(/&#13;/g, "\r")
    .replace(/&#10;/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// --- timezone conversion (no tz database needed — Node's Intl has ICU) ------

/** Wall-clock time of `utc` in `tz`, encoded as a UTC ms timestamp. */
function wallTimeInZone(utc: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/** Interpret a wall-clock date/time in `tz` and return the UTC instant. */
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tz: string,
): Date {
  const asUtc = Date.UTC(y, mo - 1, d, hh, mm, ss);
  let guess = asUtc;
  // Two iterations converge across DST boundaries.
  for (let i = 0; i < 2; i++) guess = asUtc - (wallTimeInZone(new Date(guess), tz) - guess);
  return new Date(guess);
}

/**
 * A `<input type="datetime-local">` value ("2026-07-10T14:30") read as London
 * wall-clock time, as the UTC instant to store; null when it is empty or not
 * that shape. Posted as it is, Postgres read the zoneless value as UTC, an
 * hour late all summer.
 */
export function londonLocalToUtc(value: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const [y, mo, d, hh, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  const ss = m[6] ? Number(m[6]) : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mi > 59 || ss > 59) return null;
  const date = zonedToUtc(y, mo, d, hh, mi, ss, LONDON);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** YYYY-MM-DD of a UTC instant as seen in Europe/London. */
export function londonDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function londonTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

// --- minimal ICS parsing ----------------------------------------------------

type IcsProp = { name: string; params: Record<string, string>; value: string };

function parseIcsLine(line: string): IcsProp | null {
  // NAME;PARAM=v;PARAM="q:uoted":value — scan for the first ":" outside quotes.
  let inQuotes = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      split = i;
      break;
    }
  }
  if (split === -1) return null;
  const head = line.slice(0, split);
  const value = line.slice(split + 1);
  const headParts = head.split(";");
  const name = headParts[0] ?? "";
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const p of headParts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function unescapeIcsText(v: string): string {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

type ParsedWhen = {
  allDay: boolean;
  date: Date;
  day: string;
  /** Where the wall clock below is read: "UTC" for a Z value, else an IANA zone. */
  zone: string;
  wall: [number, number, number, number, number, number];
};

/*
 * Outlook and Exchange invitations name Windows zones ("GMT Standard Time")
 * and some clients prefix the IANA name (/mozilla.org/20050126_1/Europe/London).
 * Intl throws on anything that is not an IANA zone, and one such event used
 * to fail the whole feed. The common Windows names map to their zone; any
 * other unknown name is read as London wall-clock time, like a floating time.
 */
const WINDOWS_ZONES: Record<string, string> = {
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
  "Central Europe Standard Time": "Europe/Budapest",
  "Central European Standard Time": "Europe/Warsaw",
  "E. Europe Standard Time": "Europe/Chisinau",
  "GTB Standard Time": "Europe/Bucharest",
  "FLE Standard Time": "Europe/Kiev",
  "Russian Standard Time": "Europe/Moscow",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "Arabian Standard Time": "Asia/Dubai",
  "India Standard Time": "Asia/Kolkata",
  "China Standard Time": "Asia/Shanghai",
  "Singapore Standard Time": "Asia/Singapore",
  "Taipei Standard Time": "Asia/Taipei",
  "Korea Standard Time": "Asia/Seoul",
  "Tokyo Standard Time": "Asia/Tokyo",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
  UTC: "UTC",
};

function isIanaZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The IANA zone a TZID parameter names, or London when it names none we know. */
export function resolveTzid(tzid: string | undefined): string {
  const raw = (tzid ?? "").trim();
  if (!raw) return LONDON;
  // "/mozilla.org/20050126_1/Europe/London" and the like: the IANA tail.
  const tail = /^\/[^/]+\/[^/]+\/(.+)$/.exec(raw)?.[1];
  for (const candidate of [raw, WINDOWS_ZONES[raw], tail]) {
    if (candidate && isIanaZone(candidate)) return candidate;
  }
  return LONDON;
}

function parseIcsDate(prop: IcsProp): ParsedWhen | null {
  const v = prop.value.trim();
  if (prop.params["VALUE"] === "DATE" || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    // Midnight London — only used for ordering, the day string places it.
    return {
      allDay: true,
      date: zonedToUtc(y, mo, d, 0, 0, 0, LONDON),
      day: `${m[1]}-${m[2]}-${m[3]}`,
      zone: LONDON,
      wall: [y, mo, d, 0, 0, 0],
    };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const [y, mo, d, hh, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  const ss = m[6] ? Number(m[6]) : 0;
  // TZID if given, else floating time — treat as London wall clock.
  const zone = m[7] ? "UTC" : resolveTzid(prop.params["TZID"]);
  const date =
    zone === "UTC" ? new Date(Date.UTC(y, mo - 1, d, hh, mi, ss)) : zonedToUtc(y, mo, d, hh, mi, ss, zone);
  if (Number.isNaN(date.getTime())) return null;
  return { allDay: false, date, day: londonDay(date), zone, wall: [y, mo, d, hh, mi, ss] };
}

/**
 * RFC 5545 §3.3.6 DURATION ("PT3H", "P1D", "P1W", "-PT15M"): whole weeks and
 * days, which run in calendar days, and an exact time part.
 */
export function parseIcsDuration(value: string): { days: number; ms: number } | null {
  const v = value.trim();
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v);
  if (!m || m.slice(2).every((g) => g === undefined)) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const n = (i: number) => Number(m[i] ?? 0);
  // `|| 0`: no negative zero for a part the value does not have.
  return {
    days: sign * (n(2) * 7 + n(3)) || 0,
    ms: sign * ((n(4) * 60 + n(5)) * 60 + n(6)) * 1000 || 0,
  };
}

/** The end an event stored with DTSTART + DURATION implies (exclusive, like DTEND). */
function endFromDuration(start: ParsedWhen, dur: { days: number; ms: number }): ParsedWhen {
  const [y, mo, d, hh, mi, ss] = start.wall;
  if (start.allDay) {
    // Whole days only: an all-day event has no time of day.
    const day = addDaysIso(start.day, dur.days);
    const [ey, em, ed] = isoDayParts(day);
    return { allDay: true, date: zonedToUtc(ey, em, ed, 0, 0, 0, LONDON), day, zone: LONDON, wall: [ey, em, ed, 0, 0, 0] };
  }
  // Days keep the wall-clock time across a change of the clocks; H/M/S are exact.
  const base =
    start.zone === "UTC"
      ? new Date(Date.UTC(y, mo - 1, d + dur.days, hh, mi, ss))
      : zonedToUtc(y, mo, d + dur.days, hh, mi, ss, start.zone);
  const date = new Date(base.getTime() + dur.ms);
  return { allDay: false, date, day: londonDay(date), zone: start.zone, wall: start.wall };
}

export function isoDayParts(day: string): [number, number, number] {
  const p = day.split("-");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

function addDaysIso(day: string, delta: number): string {
  const [y, m, d] = isoDayParts(day);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * The days of an inclusive span [startDay, endDay] that fall inside
 * [first, last], for placing a multi-day event on a month grid. Clamped to
 * the range rather than counted from the event's start, so an event of any
 * length reaches every month it runs in. ISO days compare as strings.
 */
export function daysWithin(startDay: string, endDay: string, first: string, last: string): string[] {
  const out: string[] = [];
  const stop = endDay < last ? endDay : last;
  // A grid is at most 42 days; the guard only stops a malformed range.
  for (let day = startDay > first ? startDay : first; day <= stop && out.length < 400; day = addDaysIso(day, 1)) {
    out.push(day);
  }
  return out;
}

export type CalResource = { href: string; etag: string | null };

/** Exported for the unit tests; the feed is the only other caller. */
export function parseIcsEvents(ics: string, cal: CalDavCalendar, resource: CalResource): CalendarEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const vevents: Record<string, IcsProp>[] = [];
  let cur: Record<string, IcsProp> | null = null;
  // Sub-components inside the event (VALARM, …) carry properties of their
  // own: an alarm's DESCRIPTION ("Reminder") or SUMMARY is not the event's.
  // Only the event's own level is read, as updateCalendarEvent writes it.
  let depth = 0;
  for (const rawLine of unfolded.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      cur = {};
      depth = 0;
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) vevents.push(cur);
      cur = null;
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (/^BEGIN:/i.test(line)) {
      depth++;
      continue;
    }
    if (/^END:/i.test(line)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;
    const prop = parseIcsLine(line);
    if (prop && !(prop.name in cur)) cur[prop.name] = prop;
  }
  // One resource = one event series. More than one VEVENT means expanded
  // recurrence instances (or overrides); any RRULE means the same on the
  // unexpanded fallback path.
  const recurring =
    vevents.length > 1 || vevents.some((p) => "RRULE" in p || "RECURRENCE-ID" in p);
  const events: CalendarEvent[] = [];
  for (const props of vevents) {
    // One malformed event is left out; it must not fail the whole feed.
    let ev: CalendarEvent | null = null;
    try {
      ev = buildEvent(props, cal, resource, recurring);
    } catch (err) {
      console.warn(
        `[caldav] skipped event ${props["UID"]?.value ?? resource.href}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (ev) events.push(ev);
  }
  return events;
}

function buildEvent(
  props: Record<string, IcsProp>,
  cal: CalDavCalendar,
  resource: CalResource,
  recurring: boolean,
): CalendarEvent | null {
  const startProp = props["DTSTART"];
  if (!startProp) return null;
  const start = parseIcsDate(startProp);
  if (!start) return null;
  // DTEND, or failing that DURATION (RFC 5545 allows either). Reading only
  // DTEND gave a DURATION event no end, and a save from the studio then
  // replaced its length with one hour.
  const duration = props["DTEND"] ? null : props["DURATION"] ? parseIcsDuration(props["DURATION"].value) : null;
  const end = props["DTEND"]
    ? parseIcsDate(props["DTEND"])
    : duration
      ? endFromDuration(start, duration)
      : null;

  let endDay = end ? end.day : start.day;
  if (end && start.allDay) {
    // All-day DTEND is exclusive per RFC 5545.
    endDay = addDaysIso(end.day, -1);
  } else if (end && !end.allDay && londonTime(end.date) === "00:00" && end.day > start.day) {
    // Timed event ending exactly at midnight shouldn't occupy the next day.
    endDay = addDaysIso(end.day, -1);
  }
  if (endDay < start.day) endDay = start.day;

  // RECURRENCE-ID distinguishes expanded instances sharing one UID.
  const uid = `${props["UID"]?.value ?? "no-uid"}:${props["RECURRENCE-ID"]?.value ?? startProp.value}`;
  return {
    uid,
    title: props["SUMMARY"] ? unescapeIcsText(props["SUMMARY"].value) : "(untitled)",
    location: props["LOCATION"] ? unescapeIcsText(props["LOCATION"].value) : null,
    description: props["DESCRIPTION"] ? unescapeIcsText(props["DESCRIPTION"].value) : null,
    allDay: start.allDay,
    start: start.date,
    end: end?.date ?? null,
    startDay: start.day,
    endDay,
    calendarName: cal.name,
    color: cal.color,
    href: resource.href,
    etag: resource.etag,
    recurring,
  };
}

/**
 * The End date the event editor shows. `endDay` is the grid's inclusive span,
 * pulled back a day for a timed event that ends at midnight; offered with the
 * true "00:00" end time it saved 18:00 to 00:00 as 18:00 to 19:00. So a timed
 * event takes the London day of its end instant (the next day, at 00:00),
 * which saves back unchanged; an all-day event keeps its inclusive last day.
 */
export function formEndDay(ev: Pick<CalendarEvent, "allDay" | "end" | "endDay" | "startDay">): string {
  if (ev.allDay) return ev.endDay;
  return ev.end ? londonDay(ev.end) : ev.startDay;
}

// --- CalDAV requests --------------------------------------------------------

async function davRequest(
  path: string,
  init: { method: string; depth?: string; body?: string; headers?: Record<string, string> },
): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("CalDAV not configured");
  return fetch(`${cfg.url}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")}`,
      ...(init.depth ? { Depth: init.depth } : {}),
      ...(init.body !== undefined
        ? { "Content-Type": "application/xml; charset=utf-8" }
        : {}),
      ...init.headers,
    },
    body: init.body,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
}

/**
 * True when fetch would request exactly this path: the URL parser rewrites
 * dot segments, plain ("/cal/.") or percent-encoded ("/%2e%2e/"), so a path
 * that passed a text check could still reach the collection above it.
 */
function isNormalisedPath(href: string): boolean {
  try {
    if (new URL(href, "http://caldav.invalid").pathname !== href) return false;
    return href.split("/").every((seg) => {
      const s = decodeURIComponent(seg);
      return s !== "." && s !== ".." && !s.includes("/") && !s.includes("\\");
    });
  } catch {
    return false;
  }
}

/**
 * Event/calendar hrefs come back from the browser as form fields, so they are
 * untrusted: only paths inside the configured account's collection are allowed.
 */
function assertSafeHref(href: string): string {
  const cfg = config();
  if (!cfg) throw new Error("CalDAV not configured");
  if (
    !href.startsWith(`/${cfg.user}/`) ||
    href.includes("..") ||
    !/^[A-Za-z0-9/._~@%-]+$/.test(href) ||
    !isNormalisedPath(href)
  ) {
    throw new Error("invalid calendar path");
  }
  return href;
}

/**
 * The target of an update or delete: one item inside one of the account's
 * calendars, `/<user>/<calendar>/<item>`, never a calendar (`/<user>/<cal>/`)
 * or the account itself, which Radicale would delete whole with every event
 * in it. No ".ics" is required: other clients name their items as they like.
 */
function assertEventHref(href: string): string {
  const safe = assertSafeHref(href);
  const segments = safe.split("/");
  if (segments.length !== 4 || !segments[2] || !segments[3]) throw new Error("invalid calendar path");
  return safe;
}

async function listCalendars(): Promise<CalDavCalendar[]> {
  const cfg = config();
  if (!cfg) return [];
  const res = await davRequest(`/${encodeURIComponent(cfg.user)}/`, {
    method: "PROPFIND",
    depth: "1",
    body: `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:I="http://apple.com/ns/ical/">
  <D:prop><D:displayname/><D:resourcetype/><I:calendar-color/></D:prop>
</D:propfind>`,
  });
  if (!res.ok && res.status !== 207) {
    throw new Error(`calendar list failed (HTTP ${res.status})`);
  }
  const xml = await res.text();
  const calendars: CalDavCalendar[] = [];
  for (const block of xmlBlocks(xml, "response")) {
    const resourceType = xmlBlocks(block, "resourcetype")[0] ?? "";
    if (!/<(?:[A-Za-z0-9_-]+:)?calendar\s*\/?>/.test(resourceType)) continue;
    const href = xmlText(block, "href");
    if (!href) continue;
    let color = xmlText(block, "calendar-color");
    // Radicale hands back #RRGGBBAA; normalise to #RRGGBB for CSS safety.
    if (color && /^#[0-9a-fA-F]{8}$/.test(color)) color = color.slice(0, 7);
    calendars.push({
      href,
      name: xmlText(block, "displayname") || "Calendar",
      color: color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : null,
    });
  }
  return calendars;
}

/*
 * Every calendar view listed the account's calendars (a PROPFIND) before it
 * could ask for events, a second round trip on each render. The list rarely
 * changes, so the read path keeps it for a few minutes in the warm function.
 * Writes still check against a fresh list.
 */
const CALENDAR_LIST_MS = 5 * 60 * 1000;
let calendarList: { at: number; calendars: CalDavCalendar[] } | null = null;

async function listCalendarsCached(): Promise<CalDavCalendar[]> {
  if (calendarList && Date.now() - calendarList.at < CALENDAR_LIST_MS) return calendarList.calendars;
  const calendars = await listCalendars();
  calendarList = { at: Date.now(), calendars };
  return calendars;
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function reportBody(from: Date, to: Date, expand: boolean): string {
  const range = `start="${toIcsUtc(from)}" end="${toIcsUtc(to)}"`;
  return `<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data>${expand ? `<C:expand ${range}/>` : ""}</C:calendar-data>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range ${range}/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
}

async function eventsForCalendar(
  cal: CalDavCalendar,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  let res = await davRequest(cal.href, {
    method: "REPORT",
    depth: "1",
    body: reportBody(from, to, true),
  });
  if (!res.ok && res.status !== 207) {
    // Older servers reject <expand>; fall back to unexpanded masters.
    res = await davRequest(cal.href, {
      method: "REPORT",
      depth: "1",
      body: reportBody(from, to, false),
    });
  }
  if (!res.ok && res.status !== 207) {
    throw new Error(`calendar "${cal.name}" query failed (HTTP ${res.status})`);
  }
  const xml = await res.text();
  const events: CalendarEvent[] = [];
  for (const block of xmlBlocks(xml, "response")) {
    const href = xmlText(block, "href");
    const data = xmlBlocks(block, "calendar-data")[0];
    if (!href || data === undefined) continue;
    const etag = xmlText(block, "getetag");
    events.push(...parseIcsEvents(unescapeXml(data), cal, { href, etag }));
  }
  return events;
}

/**
 * All shared-calendar events overlapping [from, to), across every calendar
 * the gallery account owns. Never throws — the page shows feed.status.
 */
export async function fetchCalendarFeed(from: Date, to: Date): Promise<CalendarFeed> {
  if (!calendarConfigured()) return { status: "unconfigured" };
  try {
    const calendars = await listCalendarsCached();
    const perCalendar = await Promise.all(calendars.map((c) => eventsForCalendar(c, from, to)));
    const events = perCalendar.flat();
    events.sort((a, b) => {
      if (a.startDay !== b.startDay) return a.startDay < b.startDay ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.getTime() - b.start.getTime();
    });
    return { status: "ok", calendars, events };
  } catch (err) {
    return { status: "error", message: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") return "calendar server did not respond";
  return err instanceof Error ? err.message : "unknown error";
}

// --- writes (create / update / delete events) -------------------------------

export type EventFields = {
  title: string;
  location: string | null;
  description: string | null;
  allDay: boolean;
  /** London wall-clock. endDay is inclusive; times are ignored for all-day. */
  startDay: string;
  endDay: string;
  startTime: string;
  endTime: string;
};

export type WriteResult = { ok: true } | { ok: false; message: string };

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1 — fold long lines with CRLF + space, on UTF-8 boundaries. */
function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 74) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let len = Math.min(start === 0 ? 74 : 73, bytes.length - start);
    while (len > 1 && (bytes[start + len] ?? 0) >= 0x80 && (bytes[start + len] ?? 0) < 0xc0) len--;
    parts.push(bytes.subarray(start, start + len).toString("utf8"));
    start += len;
  }
  return parts.join("\r\n ");
}

function timeParts(t: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

function dtLines(f: EventFields): string[] {
  if (f.allDay) {
    const endDay = f.endDay >= f.startDay ? f.endDay : f.startDay;
    return [
      `DTSTART;VALUE=DATE:${f.startDay.replace(/-/g, "")}`,
      // DTEND is exclusive for all-day events.
      `DTEND;VALUE=DATE:${addDaysIso(endDay, 1).replace(/-/g, "")}`,
    ];
  }
  const [sy, sm, sd] = isoDayParts(f.startDay);
  const [ey, em, ed] = isoDayParts(f.endDay);
  const [sh, smin] = timeParts(f.startTime);
  const [eh, emin] = timeParts(f.endTime);
  const start = zonedToUtc(sy, sm, sd, sh, smin, 0, LONDON);
  let end = zonedToUtc(ey, em, ed, eh, emin, 0, LONDON);
  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 60 * 1000);
  return [`DTSTART:${toIcsUtc(start)}`, `DTEND:${toIcsUtc(end)}`];
}

function eventPropLines(f: EventFields): string[] {
  const lines = [...dtLines(f), `SUMMARY:${escapeIcsText(f.title)}`];
  if (f.location) lines.push(`LOCATION:${escapeIcsText(f.location)}`);
  if (f.description) lines.push(`DESCRIPTION:${escapeIcsText(f.description)}`);
  return lines;
}

const CALENDAR_MIME = "text/calendar; charset=utf-8";

export async function createCalendarEvent(
  calendarHref: string,
  f: EventFields,
): Promise<WriteResult> {
  try {
    const href = assertSafeHref(calendarHref);
    // The target must be one of the account's own calendar collections.
    const calendars = await listCalendars();
    if (!calendars.some((c) => c.href === href)) return { ok: false, message: "unknown calendar" };
    const uid = `${crypto.randomUUID()}@jvb-studio`;
    const stamp = toIcsUtc(new Date());
    const ics =
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//JvdB Studio//CalDAV//EN",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `CREATED:${stamp}`,
        `LAST-MODIFIED:${stamp}`,
        "SEQUENCE:0",
        ...eventPropLines(f),
        "END:VEVENT",
        "END:VCALENDAR",
      ]
        .map(foldIcsLine)
        .join("\r\n") + "\r\n";
    const res = await davRequest(`${href}${uid}.ics`, {
      method: "PUT",
      body: ics,
      headers: { "Content-Type": CALENDAR_MIME, "If-None-Match": "*" },
    });
    if (!res.ok) return { ok: false, message: `save failed (HTTP ${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

export async function updateCalendarEvent(
  href: string,
  etag: string | null,
  f: EventFields,
): Promise<WriteResult> {
  try {
    const safe = assertEventHref(href);
    const got = await davRequest(safe, { method: "GET" });
    if (!got.ok) return { ok: false, message: `event fetch failed (HTTP ${got.status})` };
    const raw = await got.text();
    const lines = raw
      .replace(/\r?\n[ \t]/g, "")
      .split(/\r?\n/)
      .filter((l) => l !== "");
    if (
      lines.filter((l) => l === "BEGIN:VEVENT").length !== 1 ||
      lines.some((l) => /^RRULE[;:]/.test(l))
    ) {
      return { ok: false, message: "recurring events are edited in Apple Calendar" };
    }
    // Rewrite only the fields the form owns; every other property survives.
    // RFC 5545 puts event properties before sub-components (VALARM etc.), so
    // the new lines go right after BEGIN:VEVENT, and dropping only applies at
    // the event's own level — an alarm's DESCRIPTION is not the event's.
    const DROP = /^(SUMMARY|LOCATION|DESCRIPTION|DTSTART|DTEND|DURATION|DTSTAMP|LAST-MODIFIED|SEQUENCE)[;:]/;
    let seq = 0;
    for (const l of lines) {
      const m = /^SEQUENCE[^:]*:(\d+)/.exec(l);
      if (m) seq = Number(m[1]);
    }
    const stamp = toIcsUtc(new Date());
    let inEvent = false;
    let depth = 0;
    const out: string[] = [];
    for (const l of lines) {
      if (l === "BEGIN:VEVENT") {
        inEvent = true;
        depth = 0;
        out.push(l, `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, `SEQUENCE:${seq + 1}`);
        out.push(...eventPropLines(f));
        continue;
      }
      if (l === "END:VEVENT") {
        inEvent = false;
        out.push(l);
        continue;
      }
      if (inEvent && l.startsWith("BEGIN:")) depth++;
      if (inEvent && l.startsWith("END:")) depth--;
      if (inEvent && depth === 0 && DROP.test(l)) continue;
      out.push(l);
    }
    const res = await davRequest(safe, {
      method: "PUT",
      body: out.map(foldIcsLine).join("\r\n") + "\r\n",
      headers: { "Content-Type": CALENDAR_MIME, ...(etag ? { "If-Match": etag } : {}) },
    });
    if (res.status === 412) {
      return { ok: false, message: "event changed elsewhere — reload and try again" };
    }
    if (!res.ok) return { ok: false, message: `save failed (HTTP ${res.status})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

export async function deleteCalendarEvent(href: string, etag: string | null): Promise<WriteResult> {
  try {
    const safe = assertEventHref(href);
    const res = await davRequest(safe, {
      method: "DELETE",
      headers: etag ? { "If-Match": etag } : {},
    });
    if (res.status === 412) {
      return { ok: false, message: "event changed elsewhere — reload and try again" };
    }
    // Already gone is the outcome we wanted.
    if (!res.ok && res.status !== 404) {
      return { ok: false, message: `delete failed (HTTP ${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}
