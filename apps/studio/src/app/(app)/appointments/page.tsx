import Link from "next/link";
import { Suspense } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, getSupabase } from "@/lib/supabase";
import {
  calendarWebUrl,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarFeed,
  isoDayParts,
  londonDay,
  londonTime,
  updateCalendarEvent,
  zonedToUtc,
  type EventFields,
} from "@/lib/caldav";
import {
  AppointmentsCalendar,
  CalendarSkeleton,
  buildMonthGrid,
  type CalendarAppointment,
} from "@/components/appointments-calendar";
import { EventEditor } from "@/components/event-editor";
import { formatCount, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Appointments" };

// --- shared calendar server actions (write to Radicale over CalDAV) ---------

function cleanMonth(formData: FormData): string {
  const m = String(formData.get("month") ?? "");
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : "";
}

function backUrl(month: string, err: string | null): string {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (err) params.set("calerr", err);
  const qs = params.toString();
  return `/appointments${qs ? `?${qs}` : ""}`;
}

function fieldsFromForm(formData: FormData): EventFields | { error: string } {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "the event needs a title" };
  const startDay = String(formData.get("startDay") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) return { error: "invalid start date" };
  let endDay = String(formData.get("endDay") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDay) || endDay < startDay) endDay = startDay;
  const time = (name: string, fallback: string) => {
    const t = String(formData.get(name) ?? "");
    return /^\d{2}:\d{2}$/.test(t) ? t : fallback;
  };
  return {
    title,
    location: String(formData.get("location") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    allDay: formData.get("allDay") === "1",
    startDay,
    endDay,
    startTime: time("startTime", "10:00"),
    endTime: time("endTime", "11:00"),
  };
}

async function createEvent(formData: FormData) {
  "use server";
  if (!(await getSession())) redirect("/login");
  const month = cleanMonth(formData);
  const fields = fieldsFromForm(formData);
  let err: string | null = null;
  if ("error" in fields) {
    err = fields.error;
  } else {
    const res = await createCalendarEvent(String(formData.get("calendar") ?? ""), fields);
    if (!res.ok) err = res.message;
  }
  revalidatePath("/appointments");
  redirect(backUrl(month, err));
}

async function updateEvent(formData: FormData) {
  "use server";
  if (!(await getSession())) redirect("/login");
  const month = cleanMonth(formData);
  const fields = fieldsFromForm(formData);
  let err: string | null = null;
  if ("error" in fields) {
    err = fields.error;
  } else {
    const res = await updateCalendarEvent(
      String(formData.get("href") ?? ""),
      String(formData.get("etag") ?? "") || null,
      fields,
    );
    if (!res.ok) err = res.message;
  }
  revalidatePath("/appointments");
  redirect(backUrl(month, err));
}

async function deleteEvent(formData: FormData) {
  "use server";
  if (!(await getSession())) redirect("/login");
  const month = cleanMonth(formData);
  const res = await deleteCalendarEvent(
    String(formData.get("href") ?? ""),
    String(formData.get("etag") ?? "") || null,
  );
  revalidatePath("/appointments");
  redirect(backUrl(month, res.ok ? null : res.message));
}

type ContactLite = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Appointment = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contact_id: string | null;
  contact: ContactLite | null;
  type: { name: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No-show",
};

/**
 * appointments.status as a tone (spec R4: the word always comes with it).
 * A request waits on the gallery (warn); a confirmed visit is set (ok); the
 * settled outcomes stay neutral, danger being kept for errors.
 */
const STATUS_TONES: Record<string, Tone> = {
  requested: "warn",
  confirmed: "ok",
  completed: "neutral",
  no_show: "neutral",
  cancelled: "neutral",
};

function AppointmentStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

// "Mon, 12 Oct 2026, 14:00" in London time. This page renders on the server
// (UTC on Vercel), so a bare toLocaleString listed every summer appointment an
// hour early, out of step with the calendar grid above it.
function fmt(iso: string): string {
  return formatDateTime(iso, "short", { weekday: true });
}

async function setStatus(formData: FormData) {
  "use server";
  const db = await getSupabase();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;
  await db.from("appointments").update({ status }).eq("id", id);
  revalidatePath("/appointments");
}

function StatusActions({ appt, justify = "justify-end" }: { appt: Appointment; justify?: string }) {
  const actions: { status: string; label: string }[] = [];
  if (appt.status === "requested") {
    actions.push({ status: "confirmed", label: "Confirm" });
    actions.push({ status: "completed", label: "Mark completed" });
    actions.push({ status: "no_show", label: "Mark no-show" });
    actions.push({ status: "cancelled", label: "Cancel" });
  } else if (appt.status === "confirmed") {
    actions.push({ status: "completed", label: "Mark completed" });
    actions.push({ status: "no_show", label: "Mark no-show" });
    actions.push({ status: "cancelled", label: "Cancel" });
  }
  if (actions.length === 0) return null;
  return (
    // Wraps to a second line rather than pushing Cancel out of the frame.
    <div className={`flex flex-wrap gap-1.5 ${justify}`}>
      {actions.map((a) => (
        <form key={a.status} action={setStatus}>
          <input type="hidden" name="id" value={appt.id} />
          <input type="hidden" name="status" value={a.status} />
          {/* Cancel is a row's destructive action: quiet, in the danger colour. */}
          <Button
            type="submit"
            size="sm"
            variant={a.status === "cancelled" ? "quiet" : "secondary"}
            className={a.status === "cancelled" ? "text-danger" : undefined}
          >
            {a.label}
          </Button>
        </form>
      ))}
    </div>
  );
}

function nameOf(c: ContactLite): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

/** The person: a link to their contact when there is one. */
function Person({ appt }: { appt: Appointment }) {
  return appt.contact_id ? (
    <Link href={`/crm/contacts/${appt.contact_id}`} className="link-plain font-medium">
      {appt.contact ? nameOf(appt.contact) : (appt.name ?? "Contact")}
    </Link>
  ) : (
    <>{appt.name ?? "—"}</>
  );
}

/**
 * One appointment as a stacked row (V35): when and who on the first line,
 * type and status on the second, then contact details and notes. The actions
 * wrap below on a phone and sit at the right from md, so status and actions
 * are always on screen (the table puts them past the right edge below xl).
 */
function AppointmentItem({ appt, withActions }: { appt: Appointment; withActions: boolean }) {
  return (
    <li className="border-b border-rule py-3 md:flex md:items-start md:justify-between md:gap-6">
      <div className="min-w-0">
        <p className="text-[13px] leading-[1.45] text-ink">
          <span className="tabular">{fmt(appt.starts_at)}</span>
          <span className="text-meta"> · </span>
          <Person appt={appt} />
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[1.45] text-body">
          {appt.type?.name ? <span>{appt.type.name}</span> : null}
          <AppointmentStatusBadge status={appt.status} />
        </p>
        {appt.email || appt.phone ? (
          <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] leading-[1.4] text-body">
            {appt.email ? (
              <a href={`mailto:${appt.email}`} className="link-plain break-all">
                {appt.email}
              </a>
            ) : null}
            {appt.phone ? <span className="tabular">{appt.phone}</span> : null}
          </p>
        ) : null}
        {appt.notes ? (
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[12px] leading-[1.4] text-body" title={appt.notes}>
            {appt.notes}
          </p>
        ) : null}
      </div>
      {withActions ? (
        <div className="mt-2 md:mt-0 md:max-w-[50%] md:shrink-0">
          <StatusActions appt={appt} justify="justify-start md:justify-end" />
        </div>
      ) : null}
    </li>
  );
}

function AppointmentRow({ appt, withActions }: { appt: Appointment; withActions: boolean }) {
  return (
    <Tr>
      <Td className="whitespace-nowrap align-top">
        <span className="tabular text-ink">{fmt(appt.starts_at)}</span>
      </Td>
      <Td className="align-top text-body">{appt.type?.name ?? "—"}</Td>
      <Td className="whitespace-nowrap align-top text-ink">
        <Person appt={appt} />
      </Td>
      <Td className="whitespace-nowrap align-top text-body">
        {appt.email ? (
          <a href={`mailto:${appt.email}`} className="link-plain">
            {appt.email}
          </a>
        ) : (
          "—"
        )}
      </Td>
      <Td className="whitespace-nowrap align-top text-body">
        {appt.phone ? <span className="tabular">{appt.phone}</span> : "—"}
      </Td>
      <Td className="min-w-[140px] max-w-[260px] align-top text-[12px] leading-[1.4] text-body">
        {appt.notes ? (
          <span className="line-clamp-2 whitespace-pre-wrap break-words" title={appt.notes}>
            {appt.notes}
          </span>
        ) : null}
      </Td>
      <Td className="align-top">
        <AppointmentStatusBadge status={appt.status} />
      </Td>
      {withActions ? (
        <Td className="w-[280px] min-w-[200px] align-top text-right">
          <StatusActions appt={appt} />
        </Td>
      ) : null}
    </Tr>
  );
}

function AppointmentsTable({
  rows,
  withActions,
}: {
  rows: Appointment[];
  withActions: boolean;
}) {
  return (
    <>
      {/* Phones and tablets: stacked rows. The table needs about 1200px
          before Status and the actions fit; narrower, they sat past the
          frame's right edge (768 and 1024 alike), so it starts at xl. */}
      <ul className="border-t border-rule xl:hidden">
        {rows.map((appt) => (
          <AppointmentItem key={appt.id} appt={appt} withActions={withActions} />
        ))}
      </ul>
      <TableFrame bordered className="hidden xl:block">
        <Table className="min-w-[880px]">
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Person</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Notes</Th>
              <Th>Status</Th>
              {withActions ? (
                // relative: the hidden word is absolutely positioned, and in a
                // sideways-scrolling frame it must not escape and widen the page.
                <Th className="relative text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} withActions={withActions} />
            ))}
          </tbody>
        </Table>
      </TableFrame>
    </>
  );
}

/**
 * The month grid and the event editor, which wait on the shared calendar
 * (CalDAV, a network round trip to Radicale). Streamed in its own Suspense
 * boundary (W16) so the appointment lists below never wait for it.
 */
async function CalendarBlock({
  month,
  today,
  sp,
  appointments,
}: {
  month: string;
  today: string;
  sp: { new?: string; day?: string; edit?: string };
  appointments: CalendarAppointment[];
}) {
  // Fetch the shared calendar for the full visible grid (leading/trailing
  // days of adjacent months included), London midnight to London midnight.
  const grid = buildMonthGrid(month);
  const dayStart = (iso: string, plusDays = 0) => {
    const [y, m, d] = isoDayParts(iso);
    return zonedToUtc(y, m, d + plusDays, 0, 0, 0, "Europe/London");
  };
  const gridFirst = grid[0]?.iso ?? `${month}-01`;
  const gridLast = grid[grid.length - 1]?.iso ?? `${month}-28`;
  const feed = await fetchCalendarFeed(dayStart(gridFirst), dayStart(gridLast, 1));

  let editor: React.ReactNode = null;
  if (feed.status === "ok" && feed.calendars.length > 0 && (sp.new || sp.edit)) {
    const mode = sp.edit ? ("edit" as const) : ("new" as const);
    const event =
      mode === "edit"
        ? (feed.events.find((e) => e.uid === sp.edit && !e.recurring) ?? null)
        : null;
    if (mode === "new" || event) {
      const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
      editor = (
        <EventEditor
          mode={mode}
          month={month}
          day={day}
          calendars={feed.calendars}
          event={event}
          createAction={createEvent}
          updateAction={updateEvent}
          deleteAction={deleteEvent}
        />
      );
    }
  }

  return (
    <AppointmentsCalendar
      month={month}
      today={today}
      feed={feed}
      webUrl={calendarWebUrl()}
      appointments={appointments}
      editor={editor}
    />
  );
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    new?: string;
    day?: string;
    edit?: string;
    calerr?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();

  const today = londonDay(new Date());
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);

  const { data } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, name, email, phone, notes, contact_id, contact:crm_contacts ( id, first_name, last_name ), type:appointment_types ( name )",
    )
    .order("starts_at", { ascending: true });

  const appointments = (data ?? []).map((r) => {
    const row = r as unknown as Omit<Appointment, "contact" | "type"> & {
      contact: ContactLite | ContactLite[] | null;
      type: { name: string | null } | { name: string | null }[] | null;
    };
    const contact = Array.isArray(row.contact) ? (row.contact[0] ?? null) : (row.contact ?? null);
    const type = Array.isArray(row.type) ? (row.type[0] ?? null) : (row.type ?? null);
    return { ...row, contact, type } as Appointment;
  });

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now,
  );
  const past = appointments
    .filter((a) => a.status === "cancelled" || new Date(a.starts_at).getTime() < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const requested = upcoming.filter((a) => a.status === "requested").length;

  const calendarAppointments: CalendarAppointment[] = appointments.map((a) => {
    const start = new Date(a.starts_at);
    return {
      id: a.id,
      startsAt: a.starts_at,
      day: londonDay(start),
      time: londonTime(start),
      label:
        (a.contact ? nameOf(a.contact) : (a.name ?? null)) ?? a.type?.name ?? "Appointment",
      status: a.status,
      contactId: a.contact_id,
    };
  });

  return (
    <div>
      <PageHeader
        title="Appointments"
        meta={
          <span className="tabular">
            {formatCount(upcoming.length)} upcoming
            {requested > 0 ? ` · ${formatCount(requested)} waiting to be confirmed` : ""}
          </span>
        }
      />

      <div className="space-y-6">
        {sp.calerr ? (
          <Notice
            tone="danger"
            action={
              <ButtonLink href={`/appointments?month=${month}`} variant="quiet" size="sm">
                Dismiss
              </ButtonLink>
            }
          >
            Calendar: {sp.calerr}.
          </Notice>
        ) : null}

        {/* key: a new month shows the placeholder while its events load,
            rather than leaving the last month standing. */}
        <Suspense key={month} fallback={<CalendarSkeleton month={month} />}>
          <CalendarBlock
            month={month}
            today={today}
            sp={{ new: sp.new, day: sp.day, edit: sp.edit }}
            appointments={calendarAppointments}
          />
        </Suspense>

        {appointments.length === 0 ? (
          <EmptyState>
            No appointments yet. Bookings from the website&rsquo;s Visit page will appear here.
          </EmptyState>
        ) : (
          <>
            <Section title="Upcoming">
              {upcoming.length > 0 ? (
                <AppointmentsTable rows={upcoming} withActions />
              ) : (
                <EmptyState compact>No upcoming appointments.</EmptyState>
              )}
            </Section>

            {past.length > 0 ? (
              <Section title="Past and cancelled">
                <AppointmentsTable rows={past} withActions={false} />
              </Section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
