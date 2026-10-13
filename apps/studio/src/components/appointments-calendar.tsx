import Link from "next/link";
import type { CalendarEvent, CalendarFeed } from "@/lib/caldav";
import { isoDayParts, londonTime } from "@/lib/caldav";
import {
  MobileMonthCalendar,
  type MobileItem,
} from "@/components/mobile-month-calendar";
import { Section } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeftIcon, ChevronRightIcon, ExternalIcon, PlusIcon, RefreshIcon } from "@/components/ui/icons";

export type CalendarAppointment = {
  id: string;
  startsAt: string;
  day: string; // YYYY-MM-DD in Europe/London
  time: string; // HH:mm
  label: string;
  status: string;
  contactId: string | null;
};

export type MonthGridDay = {
  iso: string; // YYYY-MM-DD
  dayOfMonth: number;
  inMonth: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthParts(month: string): [number, number] {
  const p = month.split("-");
  return [Number(p[0]), Number(p[1])];
}

function monthLabel(month: string): string {
  const [y, m] = monthParts(month);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = monthParts(month);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Monday-start grid of full weeks covering the month. */
export function buildMonthGrid(month: string): MonthGridDay[] {
  const [y, m] = monthParts(month);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days shown before the 1st
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  const days: MonthGridDay[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    days.push({
      iso: d.toISOString().slice(0, 10),
      dayOfMonth: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
    });
  }
  return days;
}

// The calendar's own colour where CalDAV gives one (it is data: which
// calendar an event is on); otherwise the body ink.
const FALLBACK_DOT = "var(--jvb-body)";

function EventChip({ event, editHref }: { event: CalendarEvent; editHref: string | null }) {
  const body = (
    <>
      <span
        aria-hidden
        className="mt-[5px] inline-block h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: event.color ?? FALLBACK_DOT }}
      />
      <span className="min-w-0">
        {!event.allDay ? (
          <span className="tabular text-[11px] text-body">{londonTime(event.start)} </span>
        ) : null}
        <span className="break-words font-medium text-ink">{event.title}</span>
        {event.recurring ? (
          <span className="relative text-body">
            {" "}
            <RefreshIcon size={11} className="inline align-[-1px]" />
            <span className="sr-only">(repeats)</span>
          </span>
        ) : null}
      </span>
    </>
  );
  const chip = "flex items-start gap-1.5 bg-band px-1.5 py-1 text-[11.5px] leading-snug";
  const hint = [event.title, event.location].filter(Boolean).join(", ");
  if (editHref) {
    return (
      <Link href={editHref} className={`${chip} hover:bg-form-hover`} title={`${hint}. Select to edit`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={chip} title={event.recurring ? `${hint}. Repeats; edit in Apple Calendar` : hint}>
      {body}
    </div>
  );
}

function AppointmentChip({ appt }: { appt: CalendarAppointment }) {
  const cancelled = appt.status === "cancelled" || appt.status === "no_show";
  const inner = (
    <span className={`relative ${cancelled ? "line-through" : ""}`}>
      <span className="tabular text-[11px] text-body">{appt.time} </span>
      <span className="break-words font-medium text-ink">{appt.label}</span>
      {cancelled ? <span className="sr-only"> ({appt.status === "no_show" ? "no-show" : "cancelled"})</span> : null}
    </span>
  );
  return (
    <div
      className={`border border-rule-strong bg-page px-1.5 py-1 text-[11.5px] leading-snug ${cancelled ? "opacity-60" : ""}`}
      title={`Appointment · ${appt.label}`}
    >
      {appt.contactId ? (
        <Link href={`/crm/contacts/${appt.contactId}`} className="link-plain">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

/** The month's title and its navigation, shared by the calendar and its placeholder. */
function CalendarActions({
  month,
  editable,
  webUrl,
}: {
  month: string;
  editable: boolean;
  webUrl: string | null;
}) {
  return (
    <>
      {editable ? (
        <ButtonLink
          href={`/appointments?month=${month}&new=1`}
          icon={<PlusIcon size={14} />}
          size="sm"
          className="hidden sm:inline-flex"
        >
          New event
        </ButtonLink>
      ) : null}
      {webUrl ? (
        <ButtonLink
          href={webUrl}
          native
          target="_blank"
          rel="noreferrer"
          size="sm"
          variant="quiet"
          className="hidden sm:inline-flex"
        >
          Open shared calendar
          <ExternalIcon size={14} />
        </ButtonLink>
      ) : null}
      <span className="inline-flex">
        <ButtonLink href={`/appointments?month=${shiftMonth(month, -1)}`} size="sm" iconOnly label="Previous month">
          <ChevronLeftIcon size={14} />
        </ButtonLink>
        <ButtonLink href="/appointments" size="sm" className="-ml-px">
          Today
        </ButtonLink>
        <ButtonLink href={`/appointments?month=${shiftMonth(month, 1)}`} size="sm" iconOnly label="Next month" className="-ml-px">
          <ChevronRightIcon size={14} />
        </ButtonLink>
      </span>
    </>
  );
}

/**
 * What shows while the shared calendar loads (the page streams it): the
 * month's header and navigation, live already, over the grid's frame.
 */
export function CalendarSkeleton({ month }: { month: string }) {
  const grid = buildMonthGrid(month);
  return (
    <Section title={monthLabel(month)} actions={<CalendarActions month={month} editable={false} webUrl={null} />}>
      <div role="status">
        <span className="sr-only">Loading the shared calendar</span>
        <div className="sm:hidden">
          <Skeleton height={280} />
        </div>
        <div className="hidden border border-rule-strong sm:block">
          <div className="grid grid-cols-7 border-b border-rule-strong">
            {WEEKDAYS.map((d) => (
              <div key={d} className="label px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, i) => (
              <div
                key={day.iso}
                className={`min-h-[104px] border-rule p-1.5 ${i % 7 !== 0 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""}`}
              >
                <Skeleton width={16} height={10} className="ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function AppointmentsCalendar({
  month,
  today,
  feed,
  webUrl,
  appointments,
  editor,
}: {
  month: string;
  today: string;
  feed: CalendarFeed;
  webUrl: string | null;
  appointments: CalendarAppointment[];
  /** The open ?new/?edit editor panel, rendered between header and grid. */
  editor?: React.ReactNode;
}) {
  const editable = feed.status === "ok" && feed.calendars.length > 0;
  const grid = buildMonthGrid(month);
  const eventsByDay = new Map<string, CalendarEvent[]>();
  const push = <T,>(map: Map<string, T[]>, key: string, item: T) => {
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  };
  if (feed.status === "ok") {
    for (const ev of feed.events) {
      // Multi-day events appear on every day they span (capped at 62 days).
      let day = ev.startDay;
      for (let n = 0; day <= ev.endDay && n < 62; n++) {
        push(eventsByDay, day, ev);
        const [y, m, d] = isoDayParts(day);
        day = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
      }
    }
  }
  const apptsByDay = new Map<string, CalendarAppointment[]>();
  for (const a of appointments) {
    push(apptsByDay, a.day, a);
  }

  // Flattened per-day rows for the phone view (client component needs plain
  // serialisable data, and must not import the CalDAV module).
  const editHrefFor = (ev: CalendarEvent) =>
    editable && !ev.recurring
      ? `/appointments?month=${month}&edit=${encodeURIComponent(ev.uid)}`
      : null;
  const mobileItemsByDay: Record<string, MobileItem[]> = {};
  for (const day of grid) {
    const items: MobileItem[] = [];
    for (const ev of eventsByDay.get(day.iso) ?? []) {
      items.push({
        key: `ev:${ev.uid}`,
        timeLabel:
          day.iso > ev.startDay ? "→" : ev.allDay ? "all day" : londonTime(ev.start),
        title: ev.title,
        sub: ev.location,
        color: ev.color,
        kind: "event",
        href: editHrefFor(ev),
        recurring: ev.recurring,
      });
    }
    for (const a of apptsByDay.get(day.iso) ?? []) {
      items.push({
        key: `ap:${a.id}`,
        timeLabel: a.time,
        title: a.label,
        sub: "Appointment",
        color: null,
        kind: "appointment",
        href: a.contactId ? `/crm/contacts/${a.contactId}` : null,
        cancelled: a.status === "cancelled" || a.status === "no_show",
      });
    }
    if (items.length > 0) mobileItemsByDay[day.iso] = items;
  }

  return (
    <Section title={monthLabel(month)} actions={<CalendarActions month={month} editable={editable} webUrl={webUrl} />}>
      {feed.status === "unconfigured" ? (
        <Notice tone="info" inline className="mb-2">
          Shared calendar not connected. Set CALDAV_URL, CALDAV_USER and CALDAV_PASSWORD to show gallery
          calendar events here. Appointments still appear below.
        </Notice>
      ) : null}
      {feed.status === "error" ? (
        <Notice tone="warn" inline className="mb-2">
          Could not load the shared calendar ({feed.message}). Showing appointments only.
        </Notice>
      ) : null}

      {editor}

      {/* Phone: compact month grid + selected-day agenda (no sideways scroll). */}
      <div className="sm:hidden">
        <MobileMonthCalendar
          key={month}
          month={month}
          today={today}
          days={grid}
          itemsByDay={mobileItemsByDay}
          editable={editable}
        />
      </div>

      <div data-inset-focus className="hidden overflow-x-auto border border-rule-strong sm:block">
        {/* 700: the whole week fits the 768 tablet width. */}
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-rule-strong">
            {WEEKDAYS.map((d) => (
              <div key={d} className="label px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day, i) => {
              const events = eventsByDay.get(day.iso) ?? [];
              const appts = apptsByDay.get(day.iso) ?? [];
              const isToday = day.iso === today;
              return (
                <div
                  key={day.iso}
                  className={`group min-h-[104px] border-rule p-1.5 ${i % 7 !== 0 ? "border-l" : ""} ${
                    i >= 7 ? "border-t" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {editable ? (
                      <Link
                        href={`/appointments?month=${month}&new=1&day=${day.iso}`}
                        aria-label={`New event on ${day.iso}`}
                        title="New event on this day"
                        className="inline-flex h-5 w-5 items-center justify-center text-body opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <PlusIcon size={14} />
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span
                      className={
                        isToday
                          ? "tabular relative inline-flex h-[22px] min-w-[22px] items-center justify-center bg-ink px-1 text-[11.5px] font-semibold text-page"
                          : `tabular px-1 text-[11.5px] ${day.inMonth ? "text-body" : "text-meta"}`
                      }
                    >
                      {isToday ? <span className="sr-only">Today, </span> : null}
                      {day.dayOfMonth}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {events.map((ev) => (
                      <EventChip
                        key={`${ev.uid}:${day.iso}`}
                        event={ev}
                        editHref={
                          editable && !ev.recurring
                            ? `/appointments?month=${month}&edit=${encodeURIComponent(ev.uid)}`
                            : null
                        }
                      />
                    ))}
                    {appts.map((a) => (
                      <AppointmentChip key={a.id} appt={a} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {feed.status === "ok" && feed.calendars.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-body">
          {feed.calendars.map((c) => (
            <span key={c.href} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: c.color ?? FALLBACK_DOT }}
              />
              {c.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-[7px] w-[7px] border border-rule-strong bg-page" />
            Studio appointment
          </span>
        </div>
      ) : null}
    </Section>
  );
}
