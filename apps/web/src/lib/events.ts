import { formatExhibitionDates } from "@/components/exhibition-card";

export type EventStatus = "current" | "forthcoming" | "past";

type Dated = { startDate: string | null; endDate: string | null };

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
  const start = day(ev.startDate);
  const end = day(ev.endDate) ?? start;
  if (start === null && end === null) return "past";
  if (start !== null && start > today) return "forthcoming";
  if (end !== null && end >= today) return "current";
  return "past";
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

export { formatExhibitionDates as eventDates };
