export type EventStatus = "current" | "forthcoming" | "past";

type Dated = { startDate: string | null; endDate: string | null; datePrecision?: "day" | "month" | null };

function day(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return null;
  return new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
}

/**
 * Status from the dates: forthcoming until the opening day, current until the
 * closing day has passed, then past. Undated (migrated) events count as past
 * so they never sit in the hero.
 */
export function eventStatus(ev: Dated, now: Date = new Date()): EventStatus {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start = ev.datePrecision === "month" ? monthStart(ev.startDate) : day(ev.startDate);
  // Month precision: the show runs to the end of its closing month.
  const end = (ev.datePrecision === "month" ? monthEnd(ev.endDate ?? ev.startDate) : day(ev.endDate)) ?? start;
  if (start === null && end === null) return "past";
  if (start !== null && start > today) return "forthcoming";
  if (end !== null && end >= today) return "current";
  return "past";
}

function monthStart(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : new Date(t.getFullYear(), t.getMonth(), 1).getTime();
}
function monthEnd(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : new Date(t.getFullYear(), t.getMonth() + 1, 0).getTime();
}

export const STATUS_LABEL: Record<EventStatus, string> = {
  current: "Current",
  forthcoming: "Forthcoming",
  past: "Past",
};

/** "Frieze Masters" for fairs, else the venue. */
export function eventPlace(ev: { isArtFair: boolean | null; fairName: string | null; venue: string | null }): string | null {
  return (ev.isArtFair ? ev.fairName ?? ev.venue : ev.venue) || null;
}

export function eventYear(ev: Dated): string | null {
  const ref = ev.endDate ?? ev.startDate;
  const t = ref ? new Date(ref) : null;
  return t && !Number.isNaN(t.getTime()) ? String(t.getFullYear()) : null;
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
  const full = new Intl.DateTimeFormat("en-GB", month ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
  const noYear = new Intl.DateTimeFormat("en-GB", month ? { month: "long" } : { day: "numeric", month: "long" });
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const valid = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());
  if (valid(s) && valid(e)) {
    if (month && s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return full.format(s);
    const sameYear = s.getFullYear() === e.getFullYear();
    return `${sameYear ? noYear.format(s) : full.format(s)} – ${full.format(e)}`;
  }
  if (valid(s)) return full.format(s);
  if (valid(e)) return full.format(e);
  return null;
}

export const ACCESS_LABEL = { invitation: "By invitation only", rsvp: "RSVP", open: "Open to all" } as const;

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
