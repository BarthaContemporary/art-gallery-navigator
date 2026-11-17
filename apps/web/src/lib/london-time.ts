/**
 * The gallery's clock (Europe/London) for booking requests: the visitor
 * picks a London wall-clock date and time; the database and the calendar
 * invitation get the real instant. Client-safe and import-free, so the
 * booking form, the booking route and `node --test` share it.
 */

export const LONDON = "Europe/London";

/** Offset of Europe/London from UTC, in minutes, at a given instant. */
export function londonOffsetMinutes(atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, timeZoneName: "shortOffset" }).formatToParts(new Date(atMs));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "YYYY-MM-DDTHH:MM:SS" on a London clock → UTC epoch ms (NaN if unparseable). */
export function londonWallToUtc(wall: string): number {
  const naive = Date.parse(`${wall}Z`);
  if (Number.isNaN(naive)) return NaN;
  // Two passes: the offset can differ either side of a clock change.
  let guess = naive - londonOffsetMinutes(naive) * 60_000;
  guess = naive - londonOffsetMinutes(guess) * 60_000;
  return guess;
}

/** UTC epoch ms → "YYYY-MM-DDTHH:MM:SS" on a London clock. */
export function londonWall(ms: number): string {
  return new Date(ms + londonOffsetMinutes(ms) * 60_000).toISOString().slice(0, 19);
}

/** The London date ("YYYY-MM-DD") and the minutes since London midnight, now. */
export function londonNow(now: Date = new Date()): { date: string; minutes: number } {
  const wall = londonWall(now.getTime());
  return { date: wall.slice(0, 10), minutes: Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16)) };
}

/** "HH:MM" → minutes since midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * Why a requested London date and time cannot be booked, or null when it
 * can. A date that does not exist (30 February, which Date.parse rolls over
 * into March) or a time skipped by the clock change is refused, and so is
 * anything not later than now.
 */
export function bookingTimeProblem(date: string, time: string, nowMs: number = Date.now()): string | null {
  const startMs = londonWallToUtc(`${date}T${time}:00`);
  if (Number.isNaN(startMs) || londonWall(startMs).slice(0, 16) !== `${date}T${time}`) {
    return "Invalid date or time";
  }
  if (startMs <= nowMs) return "Please choose a time later than now";
  return null;
}
