import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { galleryNotificationAddress, maskAddress, sendEmail } from "@/lib/email";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { consentEvidence, mergeEvidence } from "@/lib/consent-evidence";
import { contactIdByEmail } from "@/lib/contacts";
import { clientIp, greetingName } from "@/lib/form-fields";
import { zod3Wording } from "@/lib/form-messages";
import { oneLine } from "@/lib/form-schema";
import { buildIcs } from "@/lib/ics";
import { bookingTimeProblem, londonWallToUtc } from "@/lib/london-time";
import { OPTIN_COLUMNS, settleSignUpPatch, type OptInContact } from "@/lib/newsletter-optin";
import { getSiteSettings } from "@/lib/sanity";
import { noteSent, withinSendLimit } from "@/lib/send-limit";
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
/**
 * Confirmations sent to one visitor's address in six hours; the gallery
 * hears of every request. Only confirmations actually sent count
 * (lib/send-limit), so someone re-submitting another person's address
 * cannot stop that person's own confirmations.
 */
const CONFIRMATIONS_PER_ADDRESS = 3;

const bookingSchema = z.object({
  appointmentType: z.enum(["private_viewing", "fair_meeting"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time"),
  name: oneLine(z.string().trim().min(1).max(200)),
  email: oneLine(z.string().trim().email().max(320)),
  phone: oneLine(z.string().trim().max(50)).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** Explicit agreement to be contacted (privacy policy and terms). */
  consent: z.literal(true, { error: "Please tick the box to agree to be contacted" }),
  turnstileToken: z.string().max(4096).optional(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof bookingSchema>;
  try {
    const json = await req.json();
    const parsed = bookingSchema.safeParse(json, { error: zod3Wording });
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

  // The visitor picks a London wall-clock time. The database and the
  // invitation get the real instant (timestamptz; UTC in the ICS), so the
  // studio and every calendar, in whatever time zone, show 11:00 London as
  // 11:00 London in summer as well as winter. A date that does not exist,
  // or a time that is not later than now, is refused.
  const timeProblem = bookingTimeProblem(payload.date, payload.time);
  if (timeProblem) {
    return NextResponse.json({ error: timeProblem }, { status: 400 });
  }
  const startMs = londonWallToUtc(`${payload.date}T${payload.time}:00`);
  const endMs = startMs + DEFAULT_DURATION_MINUTES * 60 * 1000;
  const startsAt = new Date(startMs).toISOString();
  const endsAt = new Date(endMs).toISOString();

  const icsUid = `${randomUUID()}@jvb-booking`;
  const confirmationKey = `booking:sent:${hashKey(payload.email)}`;
  let confirmVisitor = true;
  let supabase: ReturnType<typeof createServiceClient>;

  try {
    supabase = createServiceClient();
    if (ip && !(await rateLimit(supabase, `booking:ip:${hashKey(ip)}`, 3600, PER_IP_PER_HOUR))) {
      return NextResponse.json(
        { error: "Too many requests from here just now. Please try again later, or email us directly." },
        { status: 429 },
      );
    }

    // Find-or-create the CRM contact by the exact email. A contact already
    // on record is left as it is: the form proves nothing about who typed
    // the address (security review 2026-10, F11), and the request itself
    // is kept on the appointment. The one exception: a newsletter sign-up
    // still waiting for its confirmation has its token moved out of the
    // column, so the retention job does not delete a contact who has
    // booked a visit as an abandoned sign-up (lib/newsletter-optin).
    let contactId = await contactIdByEmail(supabase, payload.email);
    if (contactId) {
      const { data: known, error: knownError } = await supabase
        .from("crm_contacts")
        .select(OPTIN_COLUMNS)
        .eq("id", contactId)
        .maybeSingle();
      if (knownError) throw knownError;
      const patch = known ? settleSignUpPatch(known as OptInContact) : null;
      if (patch) {
        const { error: settleError } = await supabase.from("crm_contacts").update(patch).eq("id", contactId);
        if (settleError) throw settleError;
      }
    } else {
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
    confirmVisitor = await withinSendLimit(supabase, confirmationKey, 6 * 3600, CONFIRMATIONS_PER_ADDRESS);
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

      // The visitor's confirmation, and its calendar invitation, go to
      // whatever address was typed, so they carry none of the visitor's own
      // text: the greeting and the invitation's guest name are at most one
      // plain word of the typed name (lib/form-fields greetingName), and
      // the notes stay in the gallery's copy. Otherwise anyone could send a
      // chosen person a gallery email and invitation in their own words,
      // links included (security review 2026-10, F12).
      const visitorName = greetingName(payload.name);
      const invitation = (description: string, attendeeName: string | null) => {
        // TENTATIVE: this is a request; the gallery confirms it afterwards.
        const ics = buildIcs({
          uid: icsUid,
          start: new Date(startMs),
          end: new Date(endMs),
          status: "TENTATIVE",
          summary: `Requested: ${typeLabel} — ${galleryName}`,
          description,
          location: settings?.address?.replace(/\r?\n/g, ", ") ?? undefined,
          organizer: settings?.email ? { name: galleryName, email: settings.email } : undefined,
          attendee: { name: attendeeName, email: payload.email },
        });
        return {
          filename: "appointment.ics",
          content: Buffer.from(ics).toString("base64"),
          contentType: "text/calendar; method=PUBLISH",
        };
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
            visitorName ? `Dear ${visitorName},` : "Hello,",
            "",
            `Thank you — we have received your request for a ${typeLabel.toLowerCase()} on ${prettyDate} at ${payload.time} (London time).`,
            "We will confirm the appointment shortly. A calendar invitation is attached.",
            "",
            `With best wishes,`,
            galleryName,
          ].join("\n"),
          attachments: [invitation("We look forward to welcoming you.", visitorName)],
        }, "[booking] visitor confirmation");
        await noteSent(supabase, confirmationKey);
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
            `When: ${prettyDate} at ${payload.time} (London time)`,
            `Name: ${payload.name}`,
            `Email: ${payload.email}`,
            payload.phone ? `Phone: ${payload.phone}` : null,
            payload.notes ? `Notes: ${payload.notes}` : null,
            "",
            "Manage in the studio under /appointments.",
          ]
            .filter(Boolean)
            .join("\n"),
          attachments: [
            invitation(payload.notes ? `Notes: ${payload.notes}` : "We look forward to welcoming you.", payload.name),
          ],
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
