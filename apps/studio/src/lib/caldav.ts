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
  allDay: boolean;
  start: Date;
  end: Date | null;
  /** Inclusive YYYY-MM-DD day span in Europe/London, for grid placement. */
  startDay: string;
  endDay: string;
  calendarName: string;
  color: string | null;
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

function parseIcsEvents(ics: string, cal: CalDavCalendar): CalendarEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const events: CalendarEvent[] = [];
  let cur: Record<string, IcsProp> | null = null;
  for (const rawLine of unfolded.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) {
        const ev = buildEvent(cur, cal);
        if (ev) events.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const prop = parseIcsLine(line);
    if (prop && !(prop.name in cur)) cur[prop.name] = prop;
  }
  return events;
}

function buildEvent(props: Record<string, IcsProp>, cal: CalDavCalendar): CalendarEvent | null {
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
    allDay: start.allDay,
    start: start.date,
    end: end?.date ?? null,
    startDay: start.day,
    endDay,
    calendarName: cal.name,
    color: cal.color,
  };
}

// --- CalDAV requests --------------------------------------------------------

async function davRequest(
  path: string,
  init: { method: string; depth: string; body: string },
): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error("CalDAV not configured");
  return fetch(`${cfg.url}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")}`,
      Depth: init.depth,
      "Content-Type": "application/xml; charset=utf-8",
    },
    body: init.body,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
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
  for (const data of xmlBlocks(xml, "calendar-data")) {
    events.push(...parseIcsEvents(unescapeXml(data), cal));
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
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "calendar server did not respond"
        : err instanceof Error
          ? err.message
          : "unknown error";
    return { status: "error", message };
  }
}
