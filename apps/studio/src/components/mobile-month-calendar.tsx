"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Phone-sized month calendar, iPhone Calendar style: a compact grid of day
 * numbers with event dots, and the selected day's agenda underneath. Day
 * selection is pure client state so taps respond instantly; month navigation
 * and event editing stay server-rendered links. The desktop grid replaces
 * this from the `sm` breakpoint up.
 */

export type MobileDay = { iso: string; dayOfMonth: number; inMonth: boolean };

export type MobileItem = {
  key: string;
  /** "14:00", "all day", "→" for a continuing multi-day event, or null. */
  timeLabel: string | null;
  title: string;
  sub: string | null;
  color: string | null;
  kind: "event" | "appointment";
  /** Edit link for events, contact link for appointments; null = not tappable. */
  href: string | null;
  cancelled?: boolean;
  recurring?: boolean;
};

const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

function agendaHeading(iso: string, today: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  if (iso === today) return `Today · ${label}`;
  return label;
}

function Dot({ color, kind }: { color: string | null; kind: "event" | "appointment" }) {
  if (kind === "appointment") {
    return (
      <span
        aria-hidden
        className="inline-block h-[5px] w-[5px] shrink-0 rounded-[1.5px] border border-ink-faint"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-block h-[5px] w-[5px] shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "var(--jvb-ink-label, currentColor)" }}
    />
  );
}

export function MobileMonthCalendar({
  month,
  today,
  days,
  itemsByDay,
  editable,
}: {
  month: string;
  today: string;
  days: MobileDay[];
  itemsByDay: Record<string, MobileItem[]>;
  editable: boolean;
}) {
  const [selected, setSelected] = useState<string>(() => {
    if (days.some((d) => d.iso === today && d.inMonth)) return today;
    return days.find((d) => d.inMonth)?.iso ?? today;
  });
  const items = itemsByDay[selected] ?? [];

  return (
    <div>
      <div className="rounded-[11px] border border-line bg-cell px-1 pb-1 pt-2">
        <div className="grid grid-cols-7">
          {WEEKDAY_INITIALS.map((d, i) => (
            <div
              key={`${d}-${i}`}
              className="pb-1 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-ink-faint"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayItems = itemsByDay[day.iso] ?? [];
            const isSelected = day.iso === selected;
            const isToday = day.iso === today;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelected(day.iso)}
                aria-pressed={isSelected}
                aria-label={`${day.iso}${dayItems.length > 0 ? `, ${dayItems.length} item${dayItems.length === 1 ? "" : "s"}` : ""}`}
                className={`flex min-h-[46px] flex-col items-center gap-[3px] rounded-lg pt-[5px] [-webkit-tap-highlight-color:transparent] ${
                  day.inMonth ? "" : "opacity-40"
                }`}
              >
                <span
                  className={`inline-flex h-[28px] w-[28px] items-center justify-center rounded-full text-[13px] tabular-nums transition-transform duration-100 active:scale-90 ${
                    isSelected
                      ? "bg-[var(--jvb-ink-label)] font-semibold text-cell"
                      : isToday
                        ? "font-semibold text-[var(--jvb-ink-label)]"
                        : "text-ink-body"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
                <span className="flex h-[5px] items-center gap-[3px]">
                  {dayItems.slice(0, 3).map((it) => (
                    <Dot key={it.key} color={it.color} kind={it.kind} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Remounts per day so the entrance animation re-runs; the global
          reduced-motion reset in globals.css neutralises it. */}
      <div key={selected} className="jvb-rise mt-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[12.5px] font-semibold text-ink-strong">
            {agendaHeading(selected, today)}
          </h3>
          {editable ? (
            <Link
              href={`/appointments?month=${month}&new=1&day=${selected}`}
              className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid active:scale-[0.97]"
            >
              + Add
            </Link>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-muted">Nothing on this day.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[11px] border border-line bg-cell">
            {items.map((it) => {
              const row = (
                <span className="flex min-h-[44px] items-center gap-2.5 px-3 py-2">
                  <Dot color={it.color} kind={it.kind} />
                  <span className="w-[52px] shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
                    {it.timeLabel ?? ""}
                  </span>
                  <span className={`min-w-0 flex-1 ${it.cancelled ? "line-through opacity-60" : ""}`}>
                    <span className="block truncate text-[13px] font-medium text-ink-body">
                      {it.title}
                      {it.recurring ? (
                        <span aria-hidden className="text-ink-faint">
                          {" "}
                          ↻
                        </span>
                      ) : null}
                    </span>
                    {it.sub ? (
                      <span className="block truncate text-[11.5px] text-ink-muted">{it.sub}</span>
                    ) : null}
                  </span>
                  {it.href ? (
                    <span aria-hidden className="text-[13px] text-ink-faint">
                      ›
                    </span>
                  ) : null}
                </span>
              );
              return (
                <li key={it.key} className="border-b border-line-soft last:border-0">
                  {it.href ? (
                    <Link
                      href={it.href}
                      className="block transition-colors duration-100 [-webkit-tap-highlight-color:transparent] active:bg-control"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
