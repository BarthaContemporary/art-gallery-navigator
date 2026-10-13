import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  fetchCalendarFeed,
  isoDayParts,
  londonDay,
  londonTime,
  zonedToUtc,
} from "@/lib/caldav";
import { formatDate } from "@/lib/format";

const WINDOW_DAYS = 10;

type Row = {
  key: string;
  day: string;
  /** Sort key within the day; all-day items first. */
  order: string;
  time: string | null;
  label: string;
  detail: string | null;
  color: string | null;
  kind: "event" | "appointment";
  /**
   * A booking still at `requested` (every website Visit booking starts there)
   * has not been agreed yet. Without a mark it read exactly like a confirmed
   * one, so staff could expect a visitor nobody had confirmed.
   */
  toConfirm: boolean;
  /**
   * Appointments link to the appointments page, where Confirm lives. That page
   * does not read `focus` yet; it names the booking so the page can pick it
   * out later without this link changing.
   */
  href: string | null;
};

function addDaysIso(day: string, delta: number): string {
  const [y, m, d] = isoDayParts(day);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function dayHeading(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDaysIso(today, 1)) return "Tomorrow";
  // "Mon 12 Oct". `day` is already a London calendar day (YYYY-MM-DD), which
  // formatDate prints as that day without shifting it by a zone.
  return formatDate(day, "short", { weekday: true, year: false });
}

/** Dashboard card: shared-calendar events + appointments over the next 10 days. */
export async function UpcomingEventsPanel() {
  const today = londonDay(new Date());
  const [ty, tm, td] = isoDayParts(today);
  const from = zonedToUtc(ty, tm, td, 0, 0, 0, "Europe/London");
  const to = zonedToUtc(ty, tm, td + WINDOW_DAYS, 0, 0, 0, "Europe/London");

  const supabase = await getSupabase();
  const [feed, apptsRes] = await Promise.all([
    fetchCalendarFeed(from, to),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, name, contact:crm_contacts ( first_name, last_name ), type:appointment_types ( name )",
      )
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .not("status", "in", "(cancelled,no_show)")
      .order("starts_at", { ascending: true }),
  ]);

  const rows: Row[] = [];
  if (feed.status === "ok") {
    for (const ev of feed.events) {
      // Show each event once, on its start day (or today if already running).
      const day = ev.startDay >= today ? ev.startDay : today;
      if (day >= addDaysIso(today, WINDOW_DAYS)) continue;
      const runsOn = ev.endDay > day ? `until ${dayHeading(ev.endDay, today)}` : null;
      rows.push({
        key: `ev:${ev.uid}`,
        day,
        order: ev.allDay ? "" : londonTime(ev.start),
        time: ev.allDay ? null : londonTime(ev.start),
        label: ev.title,
        detail: [ev.location, runsOn].filter(Boolean).join(" · ") || null,
        color: ev.color,
        kind: "event",
        toConfirm: false,
        href: null,
      });
    }
  }
  for (const raw of apptsRes.data ?? []) {
    const r = raw as unknown as {
      id: string;
      starts_at: string;
      status: string;
      name: string | null;
      contact: { first_name: string | null; last_name: string | null } | null;
      type: { name: string | null } | null;
    };
    const contact = Array.isArray(r.contact) ? (r.contact[0] ?? null) : r.contact;
    const type = Array.isArray(r.type) ? (r.type[0] ?? null) : r.type;
    const who =
      [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") ||
      r.name ||
      "Appointment";
    const start = new Date(r.starts_at);
    const time = londonTime(start);
    rows.push({
      key: `ap:${r.id}`,
      day: londonDay(start),
      order: time,
      time,
      label: who,
      detail: type?.name ?? "Appointment",
      color: null,
      kind: "appointment",
      toConfirm: r.status === "requested",
      href: `/appointments?focus=${encodeURIComponent(r.id)}`,
    });
  }

  rows.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.order < b.order ? -1 : 1));
  const byDay = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byDay.get(row.day);
    if (list) list.push(row);
    else byDay.set(row.day, [row]);
  }

  return (
    <div className="border border-line bg-cell p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-ink-strong">Next 10 days</h2>
        <Link
          href="/appointments"
          className="text-[12px] font-medium text-ink-muted hover:text-ink-strong"
        >
          Open calendar →
        </Link>
      </div>

      {feed.status === "error" ? (
        <p className="mt-2 text-[12px] text-ink-muted">
          Could not load the shared calendar ({feed.message}) — showing appointments only.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          {feed.status === "unconfigured"
            ? "Shared calendar not connected and no appointments scheduled."
            : `Nothing scheduled in the next ${WINDOW_DAYS} days.`}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day}>
              <h3 className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                {dayHeading(day, today)}
              </h3>
              <ul className="mt-1 space-y-1">
                {items.map((row) => (
                  <li key={row.key} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                    {row.kind === "event" ? (
                      <span
                        aria-hidden
                        className="mt-[5px] inline-block h-[6px] w-[6px] shrink-0 rounded-full"
                        style={{ backgroundColor: row.color ?? "var(--jvb-ink-label, currentColor)" }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="mt-[5px] inline-block h-[6px] w-[6px] shrink-0 border border-line bg-cell"
                        title="Appointment"
                      />
                    )}
                    <span className="min-w-0 text-ink-body">
                      {row.time ? (
                        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                          {row.time}{" "}
                        </span>
                      ) : null}
                      {row.href ? (
                        <Link href={row.href} className="font-medium hover:underline">
                          {row.label}
                        </Link>
                      ) : (
                        <span className="font-medium">{row.label}</span>
                      )}
                      {/* A word, not colour alone: warn text on its own wash. */}
                      {row.toConfirm ? (
                        <span className="ml-1.5 whitespace-nowrap bg-warn-wash px-1 py-px text-micro font-medium text-warn">
                          to confirm
                        </span>
                      ) : null}
                      {row.detail ? (
                        <span className="text-[11.5px] text-ink-muted"> · {row.detail}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
