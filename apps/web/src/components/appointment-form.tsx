"use client";

import { useMemo, useState } from "react";
import { TurnstileWidget, turnstileEnabled } from "./turnstile-widget";

/**
 * "Book an appointment" (About page). Folds open inline: a month calendar to
 * suggest a date, a row of times, then name, email, phone, a note and the
 * consent tick. Posts to /api/booking, which records the appointment as
 * requested and emails both sides a calendar invitation.
 */

const TIMES = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Calendar({ value, onChange }: { value: string | null; onChange: (ymd: string) => void }) {
  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

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
    <div className="max-w-[320px] select-none">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          disabled={atCurrentMonth}
          aria-label="Previous month"
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-ink hover:text-accent disabled:text-field"
        >
          ←
        </button>
        <span className="font-sans text-ui text-ink">{MONTH.format(view)}</span>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          aria-label="Next month"
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center text-ink hover:text-accent"
        >
          →
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center" role="grid" aria-label="Choose a date">
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
          const disabled = past || sunday;
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
              className={`cal-day mx-auto my-0.5 flex h-9 w-9 items-center justify-center font-sans text-small ${
                selected ? "bg-accent text-white" : disabled ? "text-field" : "text-ink hover:bg-field"
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
    if (turnstileEnabled && !turnstileToken) {
      setError("Please wait a moment for the verification to complete, then try again.");
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
      setError(err instanceof Error ? err.message : "Could not send your request");
    }
  }

  const chosen = date && time ? `${LONG.format(new Date(`${date}T12:00:00`))} at ${time}` : null;

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
              status === "done" ? (
                <p className="font-sans text-ui text-ink" role="status">
                  Thank you — we&rsquo;ll confirm {chosen ?? "your appointment"} by email, with a calendar invitation.
                </p>
              ) : (
                <form onSubmit={onSubmit} className="flex max-w-[480px] flex-col gap-4">
                  <div>
                    <p className="label mb-2">Suggest a date and time</p>
                    <Calendar value={date} onChange={setDate} />
                    <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Choose a time">
                      {TIMES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTime(t)}
                          aria-pressed={time === t}
                          className={`min-h-[34px] px-2.5 font-sans text-small ${time === t ? "bg-accent text-white" : "bg-field text-ink hover:bg-[#e2ded6]"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 font-sans text-small text-meta" aria-live="polite">
                      {chosen ? chosen : "Monday to Saturday. Other times on request."}
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
                  <TurnstileWidget onToken={setTurnstileToken} />
                  {error ? (
                    <p className="font-sans text-small text-accent-deep" role="alert">
                      {error}
                    </p>
                  ) : null}
                </form>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
