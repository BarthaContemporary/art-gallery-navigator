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

type ParsedWhen = { allDay: boolean; date: Date; day: string };

function parseIcsDate(prop: IcsProp): ParsedWhen | null {
  const v = prop.value.trim();
  if (prop.params["VALUE"] === "DATE" || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    const day = `${m[1]}-${m[2]}-${m[3]}`;
    // Midnight London — only used for ordering, the day string places it.
    return {
      allDay: true,
      date: zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), 0, 0, 0, LONDON),
      day,
    };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const [y, mo, d, hh, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  const ss = m[6] ? Number(m[6]) : 0;
  const date = m[7]
    ? new Date(Date.UTC(y, mo - 1, d, hh, mi, ss))
    : // TZID if given, else floating time — treat as London wall clock.
      zonedToUtc(y, mo, d, hh, mi, ss, prop.params["TZID"] ?? LONDON);
  return { allDay: false, date, day: londonDay(date) };
}

export function isoDayParts(day: string): [number, number, number] {
  const p = day.split("-");
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

function addDaysIso(day: string, delta: number): string {
  const [y, m, d] = isoDayParts(day);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

type CalResource = { href: string; etag: string | null };

function parseIcsEvents(ics: string, cal: CalDavCalendar, resource: CalResource): CalendarEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const vevents: Record<string, IcsProp>[] = [];
  let cur: Record<string, IcsProp> | null = null;
  for (const rawLine of unfolded.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) vevents.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
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
    const ev = buildEvent(props, cal, resource, recurring);
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
  const end = props["DTEND"] ? parseIcsDate(props["DTEND"]) : null;

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
 * Event/calendar hrefs come back from the browser as form fields, so they are
 * untrusted: only paths inside the configured account's collection are allowed.
 */
function assertSafeHref(href: string): string {
  const cfg = config();
  if (!cfg) throw new Error("CalDAV not configured");
  if (
    !href.startsWith(`/${cfg.user}/`) ||
    href.includes("..") ||
    !/^[A-Za-z0-9/._~@%-]+$/.test(href)
  ) {
    throw new Error("invalid calendar path");
  }
  return href;
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
    const calendars = await listCalendars();
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
    const safe = assertSafeHref(href);
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
    const safe = assertSafeHref(href);
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
