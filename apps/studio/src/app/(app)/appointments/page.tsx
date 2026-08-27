import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import {
  calendarWebUrl,
  fetchCalendarFeed,
  isoDayParts,
  londonDay,
  londonTime,
  zonedToUtc,
} from "@/lib/caldav";
import {
  AppointmentsCalendar,
  buildMonthGrid,
  type CalendarAppointment,
} from "@/components/appointments-calendar";

export const metadata = { title: "Appointments" };

const btnGhost =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong";

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

function AppointmentStatusPill({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-pill px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--jvb-ink-label)]">
        <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-status-green" />
        {label}
      </span>
    );
  }
  if (status === "cancelled" || status === "no_show") {
    return (
      <span className="inline-flex items-center rounded-full border border-line-soft bg-pill px-2.5 py-0.5 text-[11.5px] font-medium text-ink-faint line-through">
        {label}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full border border-line-soft bg-pill px-2.5 py-0.5 text-[11.5px] font-medium text-ink-muted">
        {label}
      </span>
    );
  }
  // requested / fallback — neutral
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-pill px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-mid">
      {label}
    </span>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function StatusActions({ appt }: { appt: Appointment }) {
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
    <div className="flex flex-wrap justify-end gap-1.5">
      {actions.map((a) => (
        <form key={a.status} action={setStatus}>
          <input type="hidden" name="id" value={appt.id} />
          <input type="hidden" name="status" value={a.status} />
          <button type="submit" className={btnGhost}>
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}

function nameOf(c: ContactLite): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
}

function AppointmentRow({ appt, withActions }: { appt: Appointment; withActions: boolean }) {
  return (
    <tr className="border-b border-line-soft last:border-0 align-top">
      <td className="px-4 py-2.5">
        <span className="font-mono text-[12px] tabular-nums text-ink-body">
          {fmt(appt.starts_at)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-ink-body">{appt.type?.name ?? "—"}</td>
      <td className="px-4 py-2.5 text-ink-body">
        {appt.contact_id ? (
          <Link
            href={`/crm/contacts/${appt.contact_id}`}
            className="hover:text-ink-strong"
          >
            {appt.contact ? nameOf(appt.contact) : (appt.name ?? "Contact")}
          </Link>
        ) : (
          (appt.name ?? "—")
        )}
      </td>
      <td className="px-4 py-2.5 text-ink-muted">
        {appt.email ? (
          <a href={`mailto:${appt.email}`} className="hover:text-ink-strong">
            {appt.email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-2.5 text-ink-muted">
        {appt.phone ? (
          <span className="font-mono text-[12px] tabular-nums">{appt.phone}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="max-w-[240px] px-4 py-2.5 text-[12px] text-ink-soft">
        {appt.notes ? (
          <span className="line-clamp-2 whitespace-pre-wrap break-words">{appt.notes}</span>
        ) : null}
      </td>
      <td className="px-4 py-2.5">
        <AppointmentStatusPill status={appt.status} />
      </td>
      <td className="px-4 py-2.5 text-right">
        {withActions ? <StatusActions appt={appt} /> : null}
      </td>
    </tr>
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
    <div className="mt-2 overflow-x-auto rounded-[11px] border border-line">
      <table className="w-full min-w-[880px] bg-cell text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
            <th className="px-4 py-2.5 font-medium">When</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Person</th>
            <th className="px-4 py-2.5 font-medium">Email</th>
            <th className="px-4 py-2.5 font-medium">Phone</th>
            <th className="px-4 py-2.5 font-medium">Notes</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {rows.map((appt) => (
            <AppointmentRow key={appt.id} appt={appt} withActions={withActions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();

  const today = londonDay(new Date());
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);

  // Fetch the shared calendar for the full visible grid (leading/trailing
  // days of adjacent months included), London midnight to London midnight.
  const grid = buildMonthGrid(month);
  const dayStart = (iso: string, plusDays = 0) => {
    const [y, m, d] = isoDayParts(iso);
    return zonedToUtc(y, m, d + plusDays, 0, 0, 0, "Europe/London");
  };
  const gridFirst = grid[0]?.iso ?? `${month}-01`;
  const gridLast = grid[grid.length - 1]?.iso ?? `${month}-28`;
  const feedPromise = fetchCalendarFeed(dayStart(gridFirst), dayStart(gridLast, 1));

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

  const feed = await feedPromise;
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
    <div className="max-w-[1080px] space-y-8">
      <AppointmentsCalendar
        month={month}
        today={today}
        feed={feed}
        webUrl={calendarWebUrl()}
        appointments={calendarAppointments}
      />

      {appointments.length === 0 ? (
        <p className="text-[13px] text-ink-muted">
          No appointments yet — bookings from the website&rsquo;s Visit page will appear
          here.
        </p>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              Upcoming
            </h2>
            {upcoming.length > 0 ? (
              <AppointmentsTable rows={upcoming} withActions />
            ) : (
              <p className="mt-2 text-[12.5px] text-ink-muted">No upcoming appointments.</p>
            )}
          </section>

          {past.length > 0 ? (
            <section>
              <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                Past &amp; cancelled
              </h2>
              <AppointmentsTable rows={past} withActions={false} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
