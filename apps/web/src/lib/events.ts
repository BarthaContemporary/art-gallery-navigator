export type EventStatus = "current" | "forthcoming" | "past";

type Dated = { startDate: string | null; endDate: string | null; datePrecision?: "day" | "month" | null };

/*
 * Event dates are calendar dates ("2026-03-03"), not instants. They are read
 * as UTC midnights and compared and formatted in UTC throughout, so the
 * result is the same on the server and in any visitor's browser, whatever
 * the machine's own time zone.
 */

/** The calendar date as a UTC Date, or null. */
function calendarDate(d: string | null): Date | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

function day(d: string | null): number | null {
  return calendarDate(d)?.getTime() ?? null;
}

/** Today's date on the gallery's (London) clock, as a UTC midnight. */
function londonToday(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"));
}

/**
 * Status from the dates: forthcoming until the opening day, current until the
 * closing day has passed, then past. Undated (migrated) events count as past
 * so they never sit in the hero.
 */
export function eventStatus(ev: Dated, now: Date = new Date()): EventStatus {
  const today = londonToday(now);
  const start = ev.datePrecision === "month" ? monthStart(ev.startDate) : day(ev.startDate);
  // Month precision: the show runs to the end of its closing month.
  const end = (ev.datePrecision === "month" ? monthEnd(ev.endDate ?? ev.startDate) : day(ev.endDate)) ?? start;
  if (start === null && end === null) return "past";
  if (start !== null && start > today) return "forthcoming";
  if (end !== null && end >= today) return "current";
  return "past";
}

function monthStart(d: string | null): number | null {
  const t = calendarDate(d);
  return t ? Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) : null;
}
function monthEnd(d: string | null): number | null {
  const t = calendarDate(d);
  return t ? Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0) : null;
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  current: "Current",
  forthcoming: "Forthcoming",
  past: "Past",
};

/**
 * A fair stand as the site prints it after the word "Stand": the number
 * only, so a stand typed as "Stand 262" does not read "Stand Stand 262".
 * Null when there is none.
 */
export function standNumber(stand: string | null | undefined): string | null {
  const s = (stand ?? "").trim().replace(/^stand\s+/i, "").trim();
  return s || null;
}

/** "Frieze Masters" for fairs, else the venue. */
export function eventPlace(ev: { isArtFair: boolean | null; fairName: string | null; venue: string | null }): string | null {
  return (ev.isArtFair ? ev.fairName ?? ev.venue : ev.venue) || null;
}

/**
 * The year an event is filed under (its closing date, else its opening).
 * Read from the calendar date's text, not through a Date: EventTile runs in
 * the visitor's browser, where "2026-01-01" parsed as midnight UTC is still
 * 31 December 2025 anywhere west of Greenwich.
 */
export function eventYear(ev: Dated): string | null {
  const ref = ev.endDate ?? ev.startDate;
  if (!ref) return null;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(ref);
  if (m) return m[1] as string;
  const t = new Date(ref);
  return Number.isNaN(t.getTime()) ? null : String(t.getUTCFullYear());
}

/** "Current · Frieze Masters" — the orange eyebrow over an event. */
export function eventEyebrow(ev: Dated & { isArtFair: boolean | null; fairName: string | null; venue: string | null }): string {
  return [STATUS_LABEL[eventStatus(ev)], eventPlace(ev)].filter(Boolean).join(" · ");
}

/**
 * Human date range: "3 March – 12 April 2026", or with month precision
 * "March – April 2026" / "March 2026". A shared year is written once.
 */
export function eventDates(
  start: string | null,
  end: string | null,
  precision: "day" | "month" | null | undefined = "day",
): string | null {
  const month = precision === "month";
  const tz = { timeZone: "UTC" } as const;
  const full = new Intl.DateTimeFormat("en-GB", month ? { month: "long", year: "numeric", ...tz } : { day: "numeric", month: "long", year: "numeric", ...tz });
  const noYear = new Intl.DateTimeFormat("en-GB", month ? { month: "long", ...tz } : { day: "numeric", month: "long", ...tz });
  const s = calendarDate(start);
  const e = calendarDate(end);
  const valid = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());
  if (valid(s) && valid(e)) {
    if (month && s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) return full.format(s);
    const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
    return `${sameYear ? noYear.format(s) : full.format(s)} – ${full.format(e)}`;
  }
  if (valid(s)) return full.format(s);
  if (valid(e)) return full.format(e);
  return null;
}

/** What the page says after a private view's name; an open one says nothing. */
export const ACCESS_LABEL = { invitation: "By invitation only", rsvp: "RSVP", open: null } as const;

/** "Thursday 12 March, 6–8pm" for a private view; London time. */
export function privateViewWhen(start: string | null, end: string | null): string | null {
  const s = start ? new Date(start) : null;
  if (!s || Number.isNaN(s.getTime())) return null;
  const tz = "Europe/London";
  const dayPart = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(s);
  const time = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const ap = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase().replace(/\./g, "");
    return `${h}${m === "00" ? "" : `.${m}`}${ap}`;
  };
  const e = end ? new Date(end) : null;
  if (e && !Number.isNaN(e.getTime())) {
    const a = time(s), b = time(e);
    // "6–8pm" when both share the suffix
    const suf = /am|pm$/.exec(a)?.[0];
    const merged = suf && b.endsWith(suf) ? `${a.slice(0, -suf.length)}–${b}` : `${a}–${b}`;
    return `${dayPart}, ${merged}`;
  }
  return `${dayPart}, ${time(s)}`;
}
