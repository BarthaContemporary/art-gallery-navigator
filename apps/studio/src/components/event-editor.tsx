import Link from "next/link";
import type { CalDavCalendar, CalendarEvent } from "@/lib/caldav";
import { londonTime } from "@/lib/caldav";

const field =
  "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";

type Action = (formData: FormData) => Promise<void>;

/**
 * Server-rendered event form — opened via ?new=1 / ?edit=<uid>, no client JS.
 * Save/Delete are server actions that write to Radicale over CalDAV and
 * redirect back to the month view.
 */
export function EventEditor({
  mode,
  month,
  day,
  calendars,
  event,
  createAction,
  updateAction,
  deleteAction,
}: {
  mode: "new" | "edit";
  month: string;
  /** Prefilled start day for new events (from the clicked day cell). */
  day: string;
  calendars: CalDavCalendar[];
  event: CalendarEvent | null;
  createAction: Action;
  updateAction: Action;
  deleteAction: Action;
}) {
  const closeHref = `/appointments?month=${month}`;
  const startDay = event ? event.startDay : day;
  const endDay = event ? event.endDay : day;
  const startTime = event && !event.allDay ? londonTime(event.start) : "10:00";
  const endTime =
    event && !event.allDay
      ? event.end
        ? londonTime(event.end)
        : londonTime(new Date(event.start.getTime() + 60 * 60 * 1000))
      : "11:00";

  return (
    <div className="mt-3 rounded-[11px] border border-line bg-cell p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink-strong">
          {mode === "new" ? "New event" : "Edit event"}
        </h3>
        <Link href={closeHref} className="text-[12px] text-ink-muted hover:text-ink-strong">
          Close ✕
        </Link>
      </div>

      <form action={mode === "new" ? createAction : updateAction} className="mt-3">
        <input type="hidden" name="month" value={month} />
        {event ? (
          <>
            <input type="hidden" name="href" value={event.href} />
            <input type="hidden" name="etag" value={event.etag ?? ""} />
          </>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="ev-title">
              Title
            </label>
            <input
              id="ev-title"
              name="title"
              required
              defaultValue={event?.title ?? ""}
              className={field}
              placeholder="e.g. Client viewing"
            />
          </div>

          {mode === "new" ? (
            calendars.length > 1 ? (
              <div>
                <label className={label} htmlFor="ev-calendar">
                  Calendar
                </label>
                <select id="ev-calendar" name="calendar" className={field}>
                  {calendars.map((c) => (
                    <option key={c.href} value={c.href}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="calendar" value={calendars[0]?.href ?? ""} />
            )
          ) : null}

          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-[13px] text-ink-body">
              <input
                type="checkbox"
                name="allDay"
                value="1"
                defaultChecked={event?.allDay ?? false}
                className="h-4 w-4 accent-[var(--jvb-ink-label)]"
              />
              All day <span className="text-[11.5px] text-ink-faint">(times ignored)</span>
            </label>
          </div>

          <div>
            <label className={label} htmlFor="ev-start-day">
              Start date
            </label>
            <input
              id="ev-start-day"
              type="date"
              name="startDay"
              required
              defaultValue={startDay}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="ev-start-time">
              Start time
            </label>
            <input
              id="ev-start-time"
              type="time"
              name="startTime"
              defaultValue={startTime}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="ev-end-day">
              End date
            </label>
            <input
              id="ev-end-day"
              type="date"
              name="endDay"
              defaultValue={endDay}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="ev-end-time">
              End time
            </label>
            <input
              id="ev-end-time"
              type="time"
              name="endTime"
              defaultValue={endTime}
              className={field}
            />
          </div>

          <div>
            <label className={label} htmlFor="ev-location">
              Location
            </label>
            <input
              id="ev-location"
              name="location"
              defaultValue={event?.location ?? ""}
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="ev-notes">
              Notes
            </label>
            <input
              id="ev-notes"
              name="description"
              defaultValue={event?.description ?? ""}
              className={field}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--jvb-ink-label)] px-4 py-2 text-[13px] font-semibold text-cell hover:opacity-90"
            >
              {mode === "new" ? "Add event" : "Save changes"}
            </button>
            <Link
              href={closeHref}
              className="rounded-lg border border-line-control bg-control px-4 py-2 text-[13px] font-medium text-ink-mid hover:text-ink-strong"
            >
              Cancel
            </Link>
          </div>
          {mode === "edit" ? (
            <button
              type="submit"
              formAction={deleteAction}
              formNoValidate
              className="rounded-lg border border-line-control bg-control px-4 py-2 text-[13px] font-medium text-danger hover:border-danger"
            >
              Delete event
            </button>
          ) : null}
        </div>
      </form>
      <p className="mt-3 text-[11.5px] text-ink-faint">
        Changes sync to everyone&rsquo;s Apple Calendar within a few minutes. Repeating events
        are created and edited in Apple Calendar.
      </p>
    </div>
  );
}
