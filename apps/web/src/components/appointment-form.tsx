"use client";

import { useMemo, useState } from "react";
import { londonNow, minutesOf } from "@/lib/london-time";
import { TurnstileUnavailable, TurnstileWidget, turnstileEnabled } from "./turnstile-widget";

/**
 * "Book an appointment" (About page). Folds open inline: a month calendar to
 * suggest a date, a row of times, then name, email, phone, a note and the
 * consent tick. Posts to /api/booking, which records the appointment as
 * requested and emails both sides a calendar invitation.
 */

const TIMES = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The times still open on a London date: all of them on a later day, only
 * those later than now on London's today, none on an earlier day. The
 * gallery's clock decides, not the visitor's, so a visitor abroad gets the
 * same choice the server accepts (api/booking, lib/london-time).
 */
function openTimes(date: string | null, now = londonNow()): Set<string> {
  if (!date || date < now.date) return new Set();
  if (date > now.date) return new Set(TIMES);
  return new Set(TIMES.filter((t) => minutesOf(t) > now.minutes));
}

function Calendar({ value, onChange }: { value: string | null; onChange: (ymd: string) => void }) {
  // Today on the London clock, as a local calendar day like the cells below.
  const today = useMemo(() => {
    const [y, m, d] = londonNow().date.split("-").map(Number);
    return new Date(y as number, (m as number) - 1, d as number);
  }, []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // Direction of the last month change, so the grid slides in from that side.
  const [dir, setDir] = useState<1 | -1>(1);
  const shift = (by: 1 | -1) => {
    setDir(by);
    setView(new Date(view.getFullYear(), view.getMonth() + by, 1));
  };

  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [view]);

  const atCurrentMonth = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

  return (
    <div className="max-w-[340px] select-none bg-form px-3 pt-1 pb-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={atCurrentMonth}
          aria-label="Previous month"
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-ink hover:text-accent disabled:text-light/50"
        >
          ←
        </button>
        <span className="font-sans text-ui text-ink">{MONTH.format(view)}</span>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-ink hover:text-accent"
        >
          →
        </button>
      </div>
      <div
        key={`${view.getFullYear()}-${view.getMonth()}`}
        className="panel-swap mt-1 grid grid-cols-7 text-center"
        style={{ "--swap-x": `${dir * 12}px` } as React.CSSProperties}
        role="group"
        aria-label="Choose a date"
      >
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="label py-1 text-[11px]" aria-hidden>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const key = ymd(d);
          const past = d < today;
          const sunday = d.getDay() === 0;
          // Today goes once its last time has passed in London.
          const disabled = past || sunday || openTimes(key).size === 0;
          const selected = value === key;
          const isToday = d.getTime() === today.getTime();
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(key)}
              aria-pressed={selected}
              aria-label={LONG.format(d)}
              className={`cal-day tabular mx-auto my-0.5 flex h-9 w-9 items-center justify-center font-sans text-small ${
                selected ? "bg-accent text-white" : disabled ? "text-light/60" : "text-ink hover:bg-form-hover"
              } ${isToday && !selected ? "underline decoration-accent underline-offset-4" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppointmentForm() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  // A Turnstile token is spent by the first submit that reaches the server,
  // even one that then fails; after a failure the widget is remounted for a
  // fresh token, so "please try again" works straight away.
  const [turnstileRound, setTurnstileRound] = useState(0);
  // The check could not run (TurnstileWidget onUnavailable): say so instead of "please wait".
  const [turnstileDown, setTurnstileDown] = useState(false);
  const onTurnstileToken = (token: string) => {
    setTurnstileToken(token);
    if (token) setTurnstileDown(false);
  };
  const retryTurnstile = () => {
    setTurnstileDown(false);
    setError(null);
    setTurnstileRound((n) => n + 1);
  };

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (!date || !time) {
      setError("Please suggest a date and a time.");
      return;
    }
    // The form may have stayed open while the chosen hour went by.
    if (!openTimes(date).has(time)) {
      setTime(null);
      setError("That time has passed. Please choose a later one.");
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      // When the check is down, the message below the form already says why.
      setError(turnstileDown ? null : "Please wait a moment for the verification to complete, then try again.");
      return;
    }
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentType: "private_viewing",
          date,
          time,
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? "") || undefined,
          notes: String(data.get("notes") ?? "") || undefined,
          consent: data.get("consent") === "on",
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not send your request");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setTurnstileToken("");
      setTurnstileRound((n) => n + 1);
      setError(err instanceof Error ? err.message : "Could not send your request");
    }
  }

  const available = openTimes(date);
  const chosen = date && time ? `${LONG.format(new Date(`${date}T12:00:00`))} at ${time}` : null;
  // A new date can rule out the time already picked (an earlier hour today).
  const pickDate = (next: string) => {
    setDate(next);
    if (time && !openTimes(next).has(time)) setTime(null);
  };

  return (
    <div>
      <button
        type="button"
        className="link-accent min-h-[44px]"
        onClick={() => (open ? setOpen(false) : show())}
        aria-expanded={open}
      >
        Book an appointment {open ? "↑" : "↓"}
      </button>
      <div
        className="fold"
        data-open={open}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !open) setMounted(false);
        }}
      >
        <div aria-hidden={!open}>
          <div className="fold-body pt-3 pb-2">
            {mounted ? (
              <>
              <div className="fold" data-open={status !== "done"} aria-hidden={status === "done"} inert={status === "done"}>
                <div>
                  <div className="fold-body">
                <form onSubmit={onSubmit} className="flex max-w-[480px] flex-col gap-4">
                  <div>
                    <p className="label mb-2">Suggest a date and time</p>
                    <Calendar value={date} onChange={pickDate} />
                    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Choose a time">
                      {TIMES.map((t) => {
                        // Before a date is picked every time is offered; then only those still open.
                        const unavailable = date !== null && !available.has(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTime(t)}
                            disabled={unavailable}
                            aria-pressed={time === t}
                            className={`tabular min-h-[34px] px-2.5 font-sans text-small ${
                              time === t ? "bg-accent text-white" : unavailable ? "bg-form text-light/60" : "bg-form text-ink hover:bg-form-hover"
                            }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 font-sans text-small text-meta" aria-live="polite">
                      {chosen ? `${chosen} (London time)` : "Monday to Saturday, London time. Other times on request."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="sr-only" htmlFor="appt-name">Name</label>
                    <input id="appt-name" name="name" required autoComplete="name" placeholder="Name" className="field field-sm" />
                    <label className="sr-only" htmlFor="appt-email">Email</label>
                    <input id="appt-email" name="email" type="email" required autoComplete="email" placeholder="Email" className="field field-sm" />
                    <label className="sr-only" htmlFor="appt-phone">Phone (optional)</label>
                    <input id="appt-phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone (optional)" className="field field-sm" />
                    <label className="sr-only" htmlFor="appt-notes">Anything we should know</label>
                    <textarea id="appt-notes" name="notes" rows={2} placeholder="Anything we should know (optional)" className="field field-sm sm:col-span-full" />
                  </div>

                  <label className="flex items-start gap-2 py-1 font-sans text-small leading-snug text-meta">
                    <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--ink)]" />
                    <span>
                      I agree to be contacted about this appointment and accept the{" "}
                      <a href="/privacy" className="underline hover:text-ink">privacy policy</a> and{" "}
                      <a href="/terms" className="underline hover:text-ink">terms</a>.
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-sans text-small text-meta">We confirm within one working day.</span>
                    <button type="submit" className="btn btn-dark min-h-[38px] px-5 text-small" disabled={status === "sending"}>
                      {status === "sending" ? "Sending…" : "Book"}
                    </button>
                  </div>
                  <TurnstileWidget key={turnstileRound} onToken={onTurnstileToken} onUnavailable={() => setTurnstileDown(true)} />
                  {turnstileDown && !turnstileToken ? <TurnstileUnavailable onRetry={retryTurnstile} /> : null}
                  {error ? (
                    <p className="font-sans text-small text-accent-deep" role="alert">
                      {error}
                    </p>
                  ) : null}
                </form>
                  </div>
                </div>
              </div>
              <div className="fold" data-open={status === "done"} aria-hidden={status !== "done"}>
                <div>
                  <div className="fold-body">
                    <p className="font-sans text-ui text-ink" role="status">
                      {status === "done" ? (
                        <>Thank you — we&rsquo;ll confirm {chosen ?? "your appointment"} by email, with a calendar invitation.</>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
