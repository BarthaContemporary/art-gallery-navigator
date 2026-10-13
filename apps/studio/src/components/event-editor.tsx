import type { CalDavCalendar, CalendarEvent } from "@/lib/caldav";
import { londonTime } from "@/lib/caldav";
import { Panel } from "@/components/ui/section";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { SubmitterLabel } from "@/components/submitter-label";

// The studio's field look (.field, .label). Native elements throughout, so
// the posted names stay exactly what the server actions read; the touch-size
// rule in globals.css lifts them to 16px on phones, so iOS does not zoom.
const field = "field";
const label = "label mb-1";

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
    <Panel
      className="mb-3"
      title={mode === "new" ? "New event" : "Edit event"}
      actions={
        <ButtonLink href={closeHref} variant="quiet" size="sm" icon={<CloseIcon size={14} />}>
          Close
        </ButtonLink>
      }
    >
      <form action={mode === "new" ? createAction : updateAction}>
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

          <div className="flex items-end pb-1.5">
            <label className="inline-flex cursor-pointer items-start gap-2 text-[13px] leading-[1.45] text-ink">
              <input
                type="checkbox"
                name="allDay"
                value="1"
                defaultChecked={event?.allDay ?? false}
                className="mt-[2px] h-4 w-4"
              />
              <span>
                All day <span className="text-[12px] text-meta">(times ignored)</span>
              </span>
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* No pendingLabel: Delete below submits this same form, and the
                label must say "Saving…" only for a save (SubmitterLabel). */}
            <Button type="submit" variant="primary">
              <SubmitterLabel idle={mode === "new" ? "Add event" : "Save changes"} pending="Saving…" />
            </Button>
            <ButtonLink href={closeHref}>Cancel</ButtonLink>
          </div>
          {mode === "edit" ? (
            // A native button: the form-key guard records this formAction
            // override by its element.
            <button
              type="submit"
              formAction={deleteAction}
              formNoValidate
              className={buttonClass({ variant: "danger", size: "sm" })}
            >
              <SubmitterLabel idle="Delete event" pending="Deleting…" />
            </button>
          ) : null}
        </div>
      </form>
      <p className="mt-3 text-[12px] leading-[1.4] text-meta">
        Changes sync to everyone&rsquo;s Apple Calendar within a few minutes. Repeating events
        are created and edited in Apple Calendar.
      </p>
    </Panel>
  );
}
