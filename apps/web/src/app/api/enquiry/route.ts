import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { consentEvidence, mergeEvidence } from "@/lib/consent-evidence";
import { contactIdByEmail } from "@/lib/contacts";
import { fromLine, galleryNotificationAddress, maskAddress, sendEmail } from "@/lib/email";
import { enquiryEmail, enquiryOrigin, enquiryWork } from "@/lib/enquiry-email";
import { clientIp } from "@/lib/form-fields";
import { oneLine, siteText } from "@/lib/form-schema";
import {
  confirmTokenHash,
  emailedRecently,
  isSubscribed,
  newConfirmToken,
  noteOptInEmailSent,
  OPTIN_COLUMNS,
  OPTIN_OUTCOME_TEXT,
  pendingPatch,
  sendConfirmation,
  settleSignUpPatch,
  type OptInContact,
  type OptInOutcome,
} from "@/lib/newsletter-optin";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["work", "publication", "appointment"]),
  /** Human label of what the enquiry is about, e.g. "HARA Satoshi, Title | Code". */
  subject: siteText(z.string().max(300)),
  /** Inventory piece id when the work is current stock — links the enquiry to the record. */
  pieceId: z.string().uuid().optional(),
  /** The work on the website (a work's slug, or a catalogue entry's key), looked up for the email. */
  work: z
    .object({ source: z.enum(["work", "catalogue"]), id: siteText(z.string().min(1).max(200)) })
    .optional(),
  name: oneLine(z.string().trim().min(1, "Please enter your name").max(200)),
  email: oneLine(z.string().trim().email("Please enter a valid email address").max(320)),
  phone: oneLine(z.string().trim().max(50)).optional(),
  message: z.string().trim().min(1, "Please write a short message").max(3000),
  /** Postal address for orders that will be sent by mail. */
  address: z
    .object({
      line1: oneLine(z.string().trim().min(1, "Please enter your address").max(200)),
      line2: oneLine(z.string().trim().max(200)).optional(),
      city: oneLine(z.string().trim().min(1, "Please enter your city").max(120)),
      postcode: oneLine(z.string().trim().min(1, "Please enter your postcode").max(40)),
      country: oneLine(z.string().trim().min(1, "Please enter your country").max(120)),
    })
    .optional(),
  mailingList: z.boolean().optional(),
  /** Explicit agreement to be contacted about the enquiry (privacy policy and terms). */
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree to be contacted" }) }),
  turnstileToken: z.string().max(4096).optional(),
  website: z.string().optional(), // honeypot
});

const KIND_LABEL = {
  work: "Work enquiry",
  publication: "Catalogue enquiry",
  appointment: "Appointment request",
} as const;

/** Enquiries from one address in an hour: more than a keen collector sends. */
const PER_IP_PER_HOUR = 20;

const ADDRESS_COLUMNS = "phone, address_line1, address_line2, city, postcode, country";
type KnownContact = OptInContact & {
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
};

const phoneDigits = (s: string | null | undefined) => (s ?? "").replace(/[^\d+]/g, "");
const addressKey = (parts: (string | null | undefined)[]) =>
  parts.map((p) => (p ?? "").toLowerCase().replace(/[\s,.]+/g, " ").trim()).join("|");

/**
 * Inline enquiries (works, catalogues, appointments). Records the enquiry
 * against the CRM contact (created if new) and emails the gallery. Nothing
 * here touches the inventory.
 *
 * The form proves nothing about who typed the email address, so a contact
 * already on record is never changed from here (security review 2026-10,
 * F11): their phone, address and consent stay as they are, the details given
 * are kept on the enquiry, and staff are told when they differ from the
 * record. The mailing-list tick sends the same confirmation email as the
 * newsletter box, for new and existing contacts alike; consent is only
 * switched on when the owner of the address confirms. The request is kept
 * as a pending entry in the consent evidence, never as a sign-up's token:
 * an enquirer's record rests on the enquiry, and the retention job deletes
 * unconfirmed sign-ups (lib/newsletter-optin).
 */
export async function POST(req: NextRequest) {
  let payload: z.infer<typeof schema>;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (payload.website) return NextResponse.json({ ok: true });

  const ip = clientIp(req.headers);
  const turnstile = await verifyTurnstile(payload.turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  const email = payload.email.toLowerCase();
  const [firstName, ...rest] = payload.name.split(/\s+/);
  const sentAt = new Date();
  const now = sentAt.toISOString();
  const label = KIND_LABEL[payload.kind];
  const addr = payload.address;
  const addressText = addr
    ? [addr.line1, addr.line2, addr.city, addr.postcode, addr.country].filter(Boolean).join(", ")
    : null;
  const addressColumns = addr
    ? { address_line1: addr.line1, address_line2: addr.line2 ?? null, city: addr.city, postcode: addr.postcode, country: addr.country }
    : {};
  /** What became of the mailing-list tick; null when not ticked. */
  let mailing: OptInOutcome | null = null;
  /** For staff: an existing contact whose record differs from what was typed. */
  let recordNote: string | null = null;

  try {
    const supabase = createServiceClient();
    if (ip && !(await rateLimit(supabase, `enquiry:ip:${hashKey(ip)}`, 3600, PER_IP_PER_HOUR))) {
      return NextResponse.json(
        { error: "Too many enquiries from here just now. Please try again later, or email the gallery." },
        { status: 429 },
      );
    }

    // Contact: the exact address, created if new.
    const existingId = await contactIdByEmail(supabase, email);
    let existing: KnownContact | null = null;
    if (existingId) {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select(`${OPTIN_COLUMNS}, ${ADDRESS_COLUMNS}`)
        .eq("id", existingId)
        .maybeSingle();
      if (error) throw error;
      existing = data as KnownContact | null;
    }
    let contactId = existing?.id ?? null;
    // Evidence of what was agreed to: the contact tick always, the mailing
    // list tick when given (UK GDPR Art. 7(1), PECR reg. 22).
    const contactEv = consentEvidence(req, "enquiry");
    const marketingEv = payload.mailingList ? consentEvidence(req, "enquiry_mailing_list") : null;
    let confirmToken: string | null = null;

    if (existing) {
      const differs = [
        payload.phone && phoneDigits(payload.phone) !== phoneDigits(existing.phone) ? "phone number" : null,
        addr &&
        addressKey([addr.line1, addr.line2, addr.city, addr.postcode, addr.country]) !==
          addressKey([existing.address_line1, existing.address_line2, existing.city, existing.postcode, existing.country])
          ? "postal address"
          : null,
      ].filter((d): d is string => Boolean(d));
      if (differs.length > 0) {
        recordNote =
          `This email address belongs to an existing contact. The ${differs.join(" and ")} given here ` +
          `${differs.length > 1 ? "differ" : "differs"} from the contact record (or the record has none). ` +
          "The record has not been changed: check with the enquirer before updating it.";
      }
      if (marketingEv) {
        if (existing.do_not_mail) mailing = "suppressed";
        else if (isSubscribed(existing)) mailing = "already";
        else if (await emailedRecently(supabase, email)) mailing = "recent";
        else confirmToken = newConfirmToken();
      }
      // A new request, or else an earlier newsletter sign-up's token moving
      // out of the column now that this contact has sent an enquiry.
      const patch = confirmToken && marketingEv
        ? pendingPatch(existing, confirmToken, marketingEv, now, { fromSignUpBox: false })
        : settleSignUpPatch(existing);
      if (patch) {
        const { error } = await supabase.from("crm_contacts").update(patch).eq("id", existing.id);
        if (error) throw error;
      }
    } else {
      if (marketingEv) {
        if (await emailedRecently(supabase, email)) mailing = "recent";
        else confirmToken = newConfirmToken();
      }
      const evidence = mergeEvidence(null, "contact", contactEv);
      const { data: created, error } = await supabase
        .from("crm_contacts")
        .insert({
          first_name: firstName,
          last_name: rest.join(" ") || null,
          email,
          phone: payload.phone || null,
          ...addressColumns,
          marketing_consent: false,
          consent_evidence:
            confirmToken && marketingEv
              ? mergeEvidence(evidence, "marketing_pending", { ...marketingEv, token_hash: confirmTokenHash(confirmToken) })
              : evidence,
          tags: ["website"],
        })
        .select("id")
        .single();
      if (error) throw error;
      contactId = created.id;
    }

    if (confirmToken) {
      try {
        mailing = (await sendConfirmation(req, email, payload.name, confirmToken)) ? "sent" : "failed";
      } catch (err) {
        console.error("[enquiry] mailing-list confirmation failed:", err);
        mailing = "failed";
      }
      if (mailing === "sent") await noteOptInEmailSent(supabase, email);
    }

    const notes = [
      `Agreed to be contacted (privacy policy and terms) on ${now.slice(0, 10)} via the website form.`,
      mailing ? `Mailing list — ${OPTIN_OUTCOME_TEXT[mailing]}.` : null,
      recordNote,
    ].filter(Boolean);
    const { error: enquiryError } = await supabase.from("enquiries").insert({
      contact_id: contactId,
      piece_id: payload.pieceId ?? null,
      channel: "website",
      message: `${label}${payload.subject ? ` — ${payload.subject}` : ""}\n\n${payload.message}\n\nFrom: ${payload.name} <${email}>${payload.phone ? ` · ${payload.phone}` : ""}${addressText ? `\nPost to: ${addressText}` : ""}\n${notes.join("\n")}`,
    });
    if (enquiryError) throw enquiryError;
  } catch (err) {
    console.error("[enquiry] failed:", err);
    return NextResponse.json({ error: "Could not send your enquiry right now — please try again." }, { status: 500 });
  }

  // Email the gallery; a failure here must not fail the enquiry (it's
  // recorded), but it is always logged so a lost notification can be traced.
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const settings = await getSiteSettings();
    const to = galleryNotificationAddress(settings?.email);
    if (!apiKey || !to) {
      console.error(`[enquiry] gallery not notified: ${!apiKey ? "RESEND_API_KEY" : "GALLERY_NOTIFICATIONS_EMAIL (and the site settings email)"} not set`);
    } else {
      const galleryName = settings?.galleryName ?? fallbackGalleryName;
      const from = process.env.BOOKING_FROM_EMAIL ?? `website@${req.nextUrl.hostname}`;
      // The work as published, with its picture, and everything the
      // enquirer gave, then when and where the enquiry was sent from.
      const work = payload.kind === "work" ? await enquiryWork(payload.work) : null;
      const { html, text } = enquiryEmail({
        heading: `${label}${payload.subject ? ` — ${payload.subject}` : ""}`,
        message: payload.message,
        enquirer: [
          { label: "Name", value: payload.name },
          { label: "Email", value: email },
          ...(payload.phone ? [{ label: "Phone", value: payload.phone }] : []),
          ...(addressText ? [{ label: "Post to", value: addressText }] : []),
          { label: "Mailing list", value: mailing ? OPTIN_OUTCOME_TEXT[mailing] : "Not asked" },
          { label: "Agreed to", value: "Be contacted about this enquiry (Privacy Notice and Terms)" },
          ...(recordNote ? [{ label: "Contact record", value: recordNote }] : []),
        ],
        work,
        origin: enquiryOrigin(req, sentAt),
        fallbackSubject: payload.kind === "work" ? payload.subject || null : null,
      });
      const id = await sendEmail(apiKey, {
        from: fromLine(from, `${galleryName} website`),
        to,
        replyTo: email,
        subject: `${label}${payload.subject ? `: ${payload.subject}` : ""}`,
        html,
        text,
      }, "[enquiry] gallery notification");
      console.info(`[enquiry] gallery notified at ${maskAddress(to)} (Resend ${id})`);
    }
  } catch (err) {
    console.error("[enquiry] gallery notification failed:", err);
  }

  return NextResponse.json({ ok: true });
}
