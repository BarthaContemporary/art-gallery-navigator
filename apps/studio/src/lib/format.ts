/**
 * Dates, times, money and counts for the studio, in one place. Pages format
 * through these helpers rather than calling toLocaleString themselves, so the
 * same value reads the same on every page.
 *
 * Time zone. The studio is rendered on Vercel, whose servers run on UTC, and
 * Intl formats in the runtime's own zone unless it is told otherwise. A
 * server component that calls toLocaleString() therefore prints UTC: during
 * British Summer Time a 14:00 appointment listed as 13:00, while the browser
 * printed 14:00 and the calendar grid (London helpers) said 14:00. Every
 * formatter here pins Europe/London, the gallery's clock, so a time reads the
 * same whether it was rendered on the server or in the browser, and wherever
 * the person reading it happens to be.
 *
 * Calendar dates. A Postgres `date` value ("2026-10-12") names a day, not an
 * instant. It is formatted as that day, never shifted by a zone (new Date()
 * reads it as midnight UTC, which a browser west of Greenwich would print as
 * 11 October). Timestamps (anything with a time) are instants and are shown
 * in London time.
 *
 * Caveat: a few columns keep a calendar day as a UTC instant. An offer's
 * expires_at is stored as `<day>T23:59:59Z`, which in summer falls on the
 * next London day. Format those as the day they name, with
 * formatDate(value.slice(0, 10)), not as an instant.
 *
 * Everything is en-GB. Absent or unparseable values print as an em dash, the
 * studio's "no value" mark.
 */

export const GALLERY_TIME_ZONE = "Europe/London";

/** What every formatter prints for a missing value. */
export const EMPTY = "—";

export type DateInput = string | number | Date | null | undefined;

/**
 * numeric "12/10/2026" (tables, logs), short "12 Oct 2026" (the default for
 * prose and headers), long "12 October 2026" (documents and letters).
 */
export type DateStyle = "numeric" | "short" | "long";

export type DateOptions = {
  /** Prefix the short weekday: "Mon, 12 Oct 2026". */
  weekday?: boolean;
  /** Leave the year out: "12 Oct". For dates known to be recent. */
  year?: boolean;
};

export type DateTimeOptions = DateOptions & {
  /** Include seconds: "12/10/2026, 14:00:05". */
  seconds?: boolean;
};

/** A bare `date` column value, which names a day rather than an instant. */
const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Building an Intl formatter costs far more than using one, and tables call
// these once per cell, so each distinct option set is built once and kept.
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
function dateTimeFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", options);
    dateTimeFormats.set(key, format);
  }
  return format;
}

type Parsed = { date: Date; calendarDay: boolean };

function parse(value: DateInput): Parsed | null {
  if (value === null || value === undefined || value === "") return null;
  const calendarDay = typeof value === "string" && CALENDAR_DAY.test(value);
  // ECMAScript reads a bare "YYYY-MM-DD" as midnight UTC, which is what the
  // calendar-day path formats (in UTC) below.
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, calendarDay };
}

function dateParts(style: DateStyle, opts: DateOptions): Intl.DateTimeFormatOptions {
  const parts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: style === "numeric" ? "numeric" : style === "long" ? "long" : "short",
  };
  if (opts.year !== false) parts.year = "numeric";
  if (opts.weekday) parts.weekday = "short";
  return parts;
}

/** The zone a parsed value is shown in: its own day, or London time. */
function zoneFor(parsed: Parsed): string {
  return parsed.calendarDay ? "UTC" : GALLERY_TIME_ZONE;
}

/** "12 Oct 2026" (short), "12/10/2026" (numeric), "12 October 2026" (long). */
export function formatDate(value: DateInput, style: DateStyle = "short", opts: DateOptions = {}): string {
  const parsed = parse(value);
  if (!parsed) return EMPTY;
  return dateTimeFormat({ ...dateParts(style, opts), timeZone: zoneFor(parsed) }).format(parsed.date);
}

/**
 * "12 Oct 2026, 14:00" in London time. A bare calendar day has no time, so
 * it prints as formatDate would.
 */
export function formatDateTime(
  value: DateInput,
  style: DateStyle = "short",
  opts: DateTimeOptions = {},
): string {
  const parsed = parse(value);
  if (!parsed) return EMPTY;
  if (parsed.calendarDay) return formatDate(value, style, opts);
  const options: Intl.DateTimeFormatOptions = {
    ...dateParts(style, opts),
    hour: "2-digit",
    minute: "2-digit",
    // h23, so midnight is 00:00 and never 24:00.
    hourCycle: "h23",
    timeZone: GALLERY_TIME_ZONE,
  };
  if (opts.seconds) options.second = "2-digit";
  return dateTimeFormat(options).format(parsed.date);
}

/** "14:00" in London time. */
export function formatTime(value: DateInput, opts: { seconds?: boolean } = {}): string {
  const parsed = parse(value);
  if (!parsed || parsed.calendarDay) return EMPTY;
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: GALLERY_TIME_ZONE,
  };
  if (opts.seconds) options.second = "2-digit";
  return dateTimeFormat(options).format(parsed.date);
}

const relativeFormat = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/**
 * "just now", "5 minutes ago", "yesterday", "in 3 days"; beyond four weeks
 * the date itself ("12 Oct 2026"). It depends on the moment it runs, so use it
 * in client components (or pass `now`), where server and browser cannot
 * disagree about the answer.
 */
export function formatRelative(value: DateInput, now: Date | number = Date.now()): string {
  const parsed = parse(value);
  if (!parsed) return EMPTY;
  const seconds = (parsed.date.getTime() - (typeof now === "number" ? now : now.getTime())) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 45 * 60) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (abs < 22 * 3600) return relativeFormat.format(Math.round(seconds / 3600), "hour");
  if (abs < 28 * 86_400) return relativeFormat.format(Math.round(seconds / 86_400), "day");
  return formatDate(value, "short");
}

// --- money and counts -------------------------------------------------------

export type NumberInput = number | string | null | undefined;

function toNumber(value: NumberInput): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // -0 (a zero margin, say) would otherwise print as "-£0.00".
  return n === 0 ? 0 : n;
}

const GBP_EXACT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// minimumFractionDigits is given as well as the maximum: engines that predate
// the 2023 Intl rules throw a RangeError when the maximum falls below GBP's
// default minimum of 2.
const GBP_DISPLAY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const COUNT = new Intl.NumberFormat("en-GB");

/**
 * "£1,234.56", "-£50.00". To the penny, for every figure the accountant reads:
 * the stock book, VAT working and financials.
 */
export function gbpExact(value: NumberInput): string {
  const n = toNumber(value);
  return n === null ? EMPTY : GBP_EXACT.format(n);
}

/** "£12,000". Whole pounds, for prices on offers, cards and dashboard stats. */
export function gbpDisplay(value: NumberInput): string {
  const n = toNumber(value);
  return n === null ? EMPTY : GBP_DISPLAY.format(n);
}

/** "1,234". Counts and other plain numbers, grouped the British way. */
export function formatCount(value: NumberInput): string {
  const n = toNumber(value);
  return n === null ? EMPTY : COUNT.format(n);
}
