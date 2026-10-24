import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { galleryNotificationAddress, maskAddress, sendEmail } from "@/lib/email";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { consentEvidence, mergeEvidence } from "@/lib/consent-evidence";
import { contactIdByEmail } from "@/lib/contacts";
import { clientIp, ONE_LINE, ONE_LINE_MESSAGE } from "@/lib/form-fields";
import { buildIcs } from "@/lib/ics";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const APPOINTMENT_LABELS: Record<string, string> = {
  private_viewing: "Private gallery viewing",
  fair_meeting: "Meeting at a fair or exhibition",
};

const DEFAULT_DURATION_MINUTES = 60;

/** Booking requests from one address in an hour. */
const PER_IP_PER_HOUR = 10;
/** Confirmations to one visitor's address in six hours; the gallery hears of every request. */
const CONFIRMATIONS_PER_ADDRESS = 3;

const bookingSchema = z.object({
  appointmentType: z.enum(["private_viewing", "fair_meeting"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time"),
  name: z.string().trim().min(1).max(200).regex(ONE_LINE, ONE_LINE_MESSAGE),
  email: z.string().trim().email().max(320).regex(ONE_LINE, ONE_LINE_MESSAGE),
  phone: z.string().trim().max(50).regex(ONE_LINE, ONE_LINE_MESSAGE).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Explicit agreement to be contacted (privacy policy and terms). */
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree to be contacted" }) }),
  turnstileToken: z.string().max(4096).optional(),
});

const LONDON = "Europe/London";

/** Offset of Europe/London from UTC, in minutes, at a given instant. */
function londonOffsetMinutes(atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, timeZoneName: "shortOffset" }).formatToParts(new Date(atMs));
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "YYYY-MM-DDTHH:MM:SS" on a London clock → UTC epoch ms. */
function londonWallToUtc(wall: string): number {
  const naive = Date.parse(`${wall}Z`);
  if (Number.isNaN(naive)) return NaN;
  // Two passes: the offset can differ either side of a clock change.
  let guess = naive - londonOffsetMinutes(naive) * 60_000;
  guess = naive - londonOffsetMinutes(guess) * 60_000;
  return guess;
}

/** UTC epoch ms → "YYYY-MM-DDTHH:MM:SS" on a London clock (for the ICS). */
function londonWall(ms: number): string {
  return new Date(ms + londonOffsetMinutes(ms) * 60_000).toISOString().slice(0, 19);
}

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

  const ip = clientIp(req.headers);
  const turnstile = await verifyTurnstile(payload.turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  // The visitor picks a London wall-clock time. The ICS keeps that floating
  // local time; the database gets the real instant (timestamptz), so the
  // studio and calendar show 11:00 as 11:00 in summer as well as winter.
  const startLocal = `${payload.date}T${payload.time}:00`;
  const startMs = londonWallToUtc(startLocal);
  if (Number.isNaN(startMs)) {
    return NextResponse.json({ error: "Invalid date or time" }, { status: 400 });
  }
  if (startMs < Date.now() - 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Please choose a date in the future" }, { status: 400 });
  }
  const endMs = startMs + DEFAULT_DURATION_MINUTES * 60 * 1000;
  const endLocal = londonWall(endMs);
  const startsAt = new Date(startMs).toISOString();
  const endsAt = new Date(endMs).toISOString();

  const icsUid = `${randomUUID()}@jvb-booking`;
  let confirmVisitor = true;

  try {
    const supabase = createServiceClient();
    if (ip && !(await rateLimit(supabase, `booking:ip:${hashKey(ip)}`, 3600, PER_IP_PER_HOUR))) {
      return NextResponse.json(
        { error: "Too many requests from here just now. Please try again later, or email us directly." },
        { status: 429 },
      );
    }

    // Find-or-create the CRM contact by the exact email. A contact already
    // on record is left as it is: the form proves nothing about who typed
    // the address (security review 2026-10, F11), and the request itself
    // is kept on the appointment.
    let contactId = await contactIdByEmail(supabase, payload.email);
    if (!contactId) {
      const contactEv = consentEvidence(req, "booking");
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
          consent_evidence: mergeEvidence(null, "contact", contactEv),
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
      starts_at: startsAt,
      ends_at: endsAt,
      status: "requested",
      name: payload.name,
      email: payload.email,
      phone: payload.phone ?? null,
      notes: payload.notes ?? null,
      ics_uid: icsUid,
    });
    if (appointmentError) throw appointmentError;

    // The visitor's confirmation goes to whatever address was typed, so a
    // stranger's inbox cannot be filled with them from the gallery's address.
    confirmVisitor = await rateLimit(supabase, `booking:email:${hashKey(payload.email)}`, 6 * 3600, CONFIRMATIONS_PER_ADDRESS);
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

      const prettyDate = new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${payload.date}T12:00:00Z`));

      // The visitor's confirmation and the staff notification are sent
      // separately: one being refused must not stop the other.
      try {
        if (!confirmVisitor) {
          throw new Error(`${maskAddress(payload.email)} already had ${CONFIRMATIONS_PER_ADDRESS} confirmations in six hours`);
        }
        await sendEmail(apiKey, {
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
        }, "[booking] visitor confirmation");
      } catch (error) {
        console.error("[booking] visitor confirmation failed:", error);
      }

      const staffEmail = galleryNotificationAddress(settings?.email);
      if (!staffEmail) {
        console.error("[booking] gallery not notified: GALLERY_NOTIFICATIONS_EMAIL (and the site settings email) not set");
      } else {
        const id = await sendEmail(apiKey, {
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
        }, "[booking] gallery notification");
        console.info(`[booking] gallery notified at ${maskAddress(staffEmail)} (Resend ${id})`);
      }
    } else {
      console.error("[booking] no emails sent: RESEND_API_KEY not set");
    }
  } catch (error) {
    // Email failure should not fail the booking — staff see it in the studio.
    console.error("[booking] emails failed:", error);
  }

  return NextResponse.json({ ok: true });
}
