import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Resend } from "resend";
import { createServiceClient } from "@jvb/db/server";
import { buildIcs } from "@/lib/ics";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";

export const dynamic = "force-dynamic";

const APPOINTMENT_LABELS: Record<string, string> = {
  private_viewing: "Private gallery viewing",
  fair_meeting: "Meeting at a fair or exhibition",
};

const DEFAULT_DURATION_MINUTES = 60;

const bookingSchema = z.object({
  appointmentType: z.enum(["private_viewing", "fair_meeting"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time"),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof bookingSchema>;
  try {
    const json = await req.json();
    const parsed = bookingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Local (gallery-time) start/end; stored verbatim, ICS uses floating time.
  const startLocal = `${payload.date}T${payload.time}:00`;
  const startMs = Date.parse(`${startLocal}Z`);
  if (Number.isNaN(startMs)) {
    return NextResponse.json({ error: "Invalid date or time" }, { status: 400 });
  }
  if (startMs < Date.now() - 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Please choose a date in the future" }, { status: 400 });
  }
  const endLocal = new Date(startMs + DEFAULT_DURATION_MINUTES * 60 * 1000)
    .toISOString()
    .slice(0, 19);

  const icsUid = `${randomUUID()}@jvb-booking`;

  try {
    const supabase = createServiceClient();

    // Find-or-create the CRM contact by email.
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .ilike("email", payload.email)
      .maybeSingle();

    let contactId: string | null = (existing as { id: string } | null)?.id ?? null;
    if (!contactId) {
      const [firstName, ...rest] = payload.name.split(/\s+/);
      const { data: created, error: contactError } = await supabase
        .from("crm_contacts")
        .insert({
          first_name: firstName ?? payload.name,
          last_name: rest.join(" ") || null,
          email: payload.email,
          phone: payload.phone ?? null,
          contact_type: "collector",
          consent_source: "website_booking",
        })
        .select("id")
        .single();
      if (contactError) throw contactError;
      contactId = (created as { id: string }).id;
    }

    // Resolve the seeded appointment type ("Private gallery viewing" / "Fair or exhibition meeting").
    const typeName =
      payload.appointmentType === "private_viewing"
        ? "Private gallery viewing"
        : "Fair or exhibition meeting";
    const { data: typeRow } = await supabase
      .from("appointment_types")
      .select("id")
      .ilike("name", typeName)
      .maybeSingle();

    const { error: appointmentError } = await supabase.from("appointments").insert({
      contact_id: contactId,
      appointment_type_id: (typeRow as { id: string } | null)?.id ?? null,
      starts_at: startLocal,
      ends_at: endLocal,
      status: "requested",
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      notes: payload.notes ?? null,
      ics_uid: icsUid,
    });
    if (appointmentError) throw appointmentError;
  } catch (error) {
    console.error("[booking] failed to store appointment:", error);
    return NextResponse.json(
      { error: "We could not save your request. Please email us directly." },
      { status: 500 },
    );
  }

  // Confirmation + staff notification via Resend, with an ICS attachment.
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const settings = await getSiteSettings();
      const galleryName = settings?.galleryName ?? fallbackGalleryName;
      const from =
        process.env.BOOKING_FROM_EMAIL ?? `bookings@${new URL(req.nextUrl.origin).hostname}`;
      const typeLabel = APPOINTMENT_LABELS[payload.appointmentType] ?? "Appointment";

      const ics = buildIcs({
        uid: icsUid,
        start: startLocal,
        end: endLocal,
        summary: `${typeLabel} — ${galleryName}`,
        description: payload.notes
          ? `Notes: ${payload.notes}`
          : "We look forward to welcoming you.",
        location: settings?.address?.replace(/\n/g, ", ") ?? undefined,
        organizer: settings?.email ? { name: galleryName, email: settings.email } : undefined,
        attendee: { name: payload.name, email: payload.email },
      });
      const icsAttachment = {
        filename: "appointment.ics",
        content: Buffer.from(ics).toString("base64"),
        contentType: "text/calendar; method=PUBLISH",
      };

      const resend = new Resend(apiKey);

      const prettyDate = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${payload.date}T12:00:00Z`));

      await resend.emails.send({
        from,
        to: payload.email,
        subject: `Your appointment request — ${galleryName}`,
        text: [
          `Dear ${payload.name},`,
          "",
          `Thank you — we have received your request for a ${typeLabel.toLowerCase()} on ${prettyDate} at ${payload.time}.`,
          "We will confirm the appointment shortly. A calendar invitation is attached.",
          "",
          `With best wishes,`,
          galleryName,
        ].join("\n"),
        attachments: [icsAttachment],
      });

      const staffEmail = process.env.GALLERY_NOTIFICATIONS_EMAIL ?? settings?.email;
      if (staffEmail) {
        await resend.emails.send({
          from,
          to: staffEmail,
          subject: `New booking request: ${payload.name} — ${prettyDate} ${payload.time}`,
          text: [
            `Type: ${typeLabel}`,
            `When: ${prettyDate} at ${payload.time}`,
            `Name: ${payload.name}`,
            `Email: ${payload.email}`,
            payload.phone ? `Phone: ${payload.phone}` : null,
            payload.notes ? `Notes: ${payload.notes}` : null,
            "",
            "Manage in the studio under /appointments.",
          ]
            .filter(Boolean)
            .join("\n"),
          attachments: [icsAttachment],
        });
      }
    }
  } catch (error) {
    // Email failure should not fail the booking — staff see it in the studio.
    console.error("[booking] confirmation email failed:", error);
  }

  return NextResponse.json({ ok: true });
}
