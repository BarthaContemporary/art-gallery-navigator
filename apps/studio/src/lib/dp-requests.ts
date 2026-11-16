/*
 * Dates of the data-subject request register (Admin → Data protection and
 * the contact page's "Log a request"). Pure, with no imports, so the client
 * panel, the server actions and `node --test` can all use it.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in London as YYYY-MM-DD. The server runs on UTC, which is yesterday after midnight in summer. */
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The value when it is a real calendar day written YYYY-MM-DD, else null. */
export function validIsoDay(value: unknown): string | null {
  const m = ISO_DAY.exec(String(value ?? "").trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? m[0] : null;
}

/**
 * One calendar month after a YYYY-MM-DD day: the same day of the next month,
 * or that month's last day when it has no such day (31 January gives 28 or
 * 29 February, never 3 March). This is the one-month deadline for a request
 * (UK GDPR Art. 12(3)), and what the column default
 * `(current_date + interval '1 month')::date` does in the database.
 * JavaScript's setMonth rolled the missing days into the month after.
 */
export function addOneMonth(day: string): string {
  const m = ISO_DAY.exec(day);
  if (!m) throw new Error(`not a YYYY-MM-DD day: ${day}`);
  const y = Number(m[1]);
  const mo = Number(m[2]); // 1-12
  const d = Number(m[3]);
  const ty = mo === 12 ? y + 1 : y;
  const tm = mo === 12 ? 1 : mo + 1;
  // Day 0 of the month after the target month is the target month's last day.
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  return `${String(ty).padStart(4, "0")}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

/** The longest retention period the schedule accepts (20 years), as the database check does. */
export const RETENTION_MAX_DAYS = 7300;

/**
 * A retention period typed into the schedule: whole days, 1 to 7300, or null
 * for anything else. Never a guess: a blank box used to become 1 day, and the
 * nightly run then deleted everything in that class older than a day.
 */
export function parseRetentionDays(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= RETENTION_MAX_DAYS ? n : null;
}

/**
 * The received and due days of a request being logged: the posted day when it
 * is a real day, else today in London; due one calendar month later.
 */
export function requestDates(received: unknown, now: Date = new Date()): { received_at: string; due_at: string } {
  const day = validIsoDay(received) ?? londonToday(now);
  return { received_at: day, due_at: addOneMonth(day) };
}
