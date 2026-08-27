import Link from "next/link";
import type { CalendarEvent, CalendarFeed } from "@/lib/caldav";
import { isoDayParts, londonTime } from "@/lib/caldav";
import {
  MobileMonthCalendar,
  type MobileItem,
} from "@/components/mobile-month-calendar";

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

function EventChip({ event, editHref }: { event: CalendarEvent; editHref: string | null }) {
  const body = (
    <>
      <span
        aria-hidden
        className="mt-[4px] inline-block h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ backgroundColor: event.color ?? "var(--jvb-ink-label, currentColor)" }}
      />
      <span className="min-w-0">
        {!event.allDay ? (
          <span className="font-mono text-[10.5px] tabular-nums text-ink-muted">
            {londonTime(event.start)}{" "}
          </span>
        ) : null}
        <span className="break-words font-medium">{event.title}</span>
        {event.recurring ? (
          <span aria-hidden className="text-ink-faint">
            {" "}
            ↻
          </span>
        ) : null}
      </span>
    </>
  );
  const chip = "flex items-start gap-1.5 rounded-md bg-pill px-1.5 py-1 text-[11px] leading-snug text-ink-body";
  const hint = [event.title, event.location].filter(Boolean).join(" — ");
  if (editHref) {
    return (
      <Link href={editHref} className={`${chip} hover:bg-control`} title={`${hint} — click to edit`}>
        {body}
      </Link>
    );
  }
  return (
    <div className={chip} title={event.recurring ? `${hint} — repeats; edit in Apple Calendar` : hint}>
      {body}
    </div>
  );
}

function AppointmentChip({ appt }: { appt: CalendarAppointment }) {
  const cancelled = appt.status === "cancelled" || appt.status === "no_show";
  const inner = (
    <span className={cancelled ? "line-through opacity-60" : undefined}>
      <span className="font-mono text-[10.5px] tabular-nums text-ink-muted">{appt.time} </span>
      <span className="break-words font-medium">{appt.label}</span>
    </span>
  );
  return (
    <div
      className="rounded-md border border-line-soft bg-cell px-1.5 py-1 text-[11px] leading-snug text-ink-body"
      title={`Appointment · ${appt.label}`}
    >
      {appt.contactId ? (
        <Link href={`/crm/contacts/${appt.contactId}`} className="hover:text-ink-strong">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

const navBtn =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid transition-transform duration-100 [-webkit-tap-highlight-color:transparent] hover:text-ink-strong active:scale-[0.97]";

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
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Calendar
          </h2>
          <span className="text-[13.5px] font-semibold text-ink-strong">
            {monthLabel(month)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {editable ? (
            <Link
              href={`/appointments?month=${month}&new=1`}
              className={`${navBtn} hidden sm:inline-block`}
            >
              + New event
            </Link>
          ) : null}
          {webUrl ? (
            <a
              href={webUrl}
              target="_blank"
              rel="noreferrer"
              className={`${navBtn} hidden sm:inline-block`}
            >
              Open shared calendar ↗
            </a>
          ) : null}
          <Link href={`/appointments?month=${shiftMonth(month, -1)}`} className={navBtn} aria-label="Previous month">
            ←
          </Link>
          <Link href="/appointments" className={navBtn}>
            Today
          </Link>
          <Link href={`/appointments?month=${shiftMonth(month, 1)}`} className={navBtn} aria-label="Next month">
            →
          </Link>
        </div>
      </div>

      {feed.status === "unconfigured" ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          Shared calendar not connected — set CALDAV_URL, CALDAV_USER and CALDAV_PASSWORD to
          show gallery calendar events here. Appointments still appear below.
        </p>
      ) : null}
      {feed.status === "error" ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          Could not load the shared calendar ({feed.message}) — showing appointments only.
        </p>
      ) : null}

      {editor}

      {/* Phone: compact month grid + selected-day agenda (no sideways scroll). */}
      <div className="mt-2 sm:hidden">
        <MobileMonthCalendar
          key={month}
          month={month}
          today={today}
          days={grid}
          itemsByDay={mobileItemsByDay}
          editable={editable}
        />
      </div>

      <div className="mt-2 hidden overflow-x-auto rounded-[11px] border border-line sm:block">
        <div className="min-w-[880px] bg-cell">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint"
              >
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
                  className={`group min-h-[104px] border-line-soft p-1.5 ${i % 7 !== 0 ? "border-l" : ""} ${
                    i >= 7 ? "border-t" : ""
                  } ${day.inMonth ? "" : "opacity-45"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    {editable ? (
                      <Link
                        href={`/appointments?month=${month}&new=1&day=${day.iso}`}
                        aria-label={`New event on ${day.iso}`}
                        title="New event on this day"
                        className="px-1 text-[12px] leading-none text-ink-faint opacity-0 transition-opacity hover:text-ink-strong group-hover:opacity-100"
                      >
                        +
                      </Link>
                    ) : (
                      <span />
                    )}
                    <span
                      className={
                        isToday
                          ? "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--jvb-ink-label)] px-1 text-[11.5px] font-semibold text-cell"
                          : "px-1 text-[11.5px] tabular-nums text-ink-muted"
                      }
                    >
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
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-muted">
          {feed.calendars.map((c) => (
            <span key={c.href} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ backgroundColor: c.color ?? "var(--jvb-ink-label, currentColor)" }}
              />
              {c.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-[7px] w-[7px] rounded-[2px] border border-line-soft bg-cell" />
            Studio appointment
          </span>
        </div>
      ) : null}
    </section>
  );
}
