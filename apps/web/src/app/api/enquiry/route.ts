import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { createServiceClient } from "@jvb/db/server";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName } from "@/lib/site";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["work", "publication", "appointment"]),
  /** Human label of what the enquiry is about, e.g. "HARA Satoshi, Title | Code". */
  subject: z.string().trim().max(300),
  /** Inventory piece id when the work is current stock — links the enquiry to the record. */
  pieceId: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email address").max(320),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().min(1, "Please write a short message").max(3000),
  /** Postal address for orders that will be sent by mail. */
  address: z
    .object({
      line1: z.string().trim().min(1, "Please enter your address").max(200),
      line2: z.string().trim().max(200).optional(),
      city: z.string().trim().min(1, "Please enter your city").max(120),
      postcode: z.string().trim().min(1, "Please enter your postcode").max(40),
      country: z.string().trim().min(1, "Please enter your country").max(120),
    })
    .optional(),
  mailingList: z.boolean().optional(),
  /** Explicit agreement to be contacted about the enquiry (privacy policy and terms). */
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree to be contacted" }) }),
  turnstileToken: z.string().optional(),
  website: z.string().optional(), // honeypot
});

const KIND_LABEL = {
  work: "Work enquiry",
  publication: "Catalogue enquiry",
  appointment: "Appointment request",
} as const;

/**
 * Inline enquiries (works, catalogues, appointments). Records the enquiry
 * against the CRM contact (created if new), optionally opts them into the
 * mailing list, and emails the gallery. Nothing here touches the inventory.
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

  const turnstile = await verifyTurnstile(
    payload.turnstileToken,
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for"),
  );
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  const email = payload.email.toLowerCase();
  const [firstName, ...rest] = payload.name.split(/\s+/);
  const now = new Date().toISOString();
  const label = KIND_LABEL[payload.kind];
  const addr = payload.address;
  const addressText = addr
    ? [addr.line1, addr.line2, addr.city, addr.postcode, addr.country].filter(Boolean).join(", ")
    : null;
  const addressColumns = addr
    ? { address_line1: addr.line1, address_line2: addr.line2 ?? null, city: addr.city, postcode: addr.postcode, country: addr.country }
    : {};

  try {
    const supabase = createServiceClient();

    // Contact: match on email, create if new; consent only when ticked.
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id, marketing_consent")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    let contactId = existing?.id ?? null;
    if (existing) {
      if (payload.mailingList && !existing.marketing_consent) {
        await supabase
          .from("crm_contacts")
          .update({ marketing_consent: true, consent_date: now, consent_source: "website_enquiry", unsubscribed_at: null })
          .eq("id", existing.id);
      }
      if (payload.phone) await supabase.from("crm_contacts").update({ phone: payload.phone }).eq("id", existing.id).is("phone", null);
      // A posted order is the freshest address we have for the contact.
      if (addr) await supabase.from("crm_contacts").update(addressColumns).eq("id", existing.id);
    } else {
      const { data: created, error } = await supabase
        .from("crm_contacts")
        .insert({
          first_name: firstName,
          last_name: rest.join(" ") || null,
          email,
          phone: payload.phone || null,
          ...addressColumns,
          marketing_consent: Boolean(payload.mailingList),
          consent_date: payload.mailingList ? now : null,
          consent_source: payload.mailingList ? "website_enquiry" : null,
          tags: ["website"],
        })
        .select("id")
        .single();
      if (error) throw error;
      contactId = created.id;
    }

    const { error: enquiryError } = await supabase.from("enquiries").insert({
      contact_id: contactId,
      piece_id: payload.pieceId ?? null,
      channel: "website",
      message: `${label}${payload.subject ? ` — ${payload.subject}` : ""}\n\n${payload.message}\n\nFrom: ${payload.name} <${email}>${payload.phone ? ` · ${payload.phone}` : ""}${addressText ? `\nPost to: ${addressText}` : ""}\nAgreed to be contacted (privacy policy and terms) on ${now.slice(0, 10)} via the website form.`,
    });
    if (enquiryError) throw enquiryError;
  } catch (err) {
    console.error("[enquiry] failed:", err);
    return NextResponse.json({ error: "Could not send your enquiry right now — please try again." }, { status: 500 });
  }

  // Email the gallery; a failure here must not fail the enquiry (it's recorded).
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.GALLERY_NOTIFICATIONS_EMAIL;
  if (apiKey && to) {
    try {
      const settings = await getSiteSettings();
      const galleryName = settings?.galleryName ?? fallbackGalleryName;
      const from = process.env.BOOKING_FROM_EMAIL ?? `website@${req.nextUrl.hostname}`;
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: `${galleryName} website <${from}>`,
        to,
        replyTo: email,
        subject: `${label}${payload.subject ? `: ${payload.subject}` : ""}`,
        text: [
          `${label}${payload.subject ? ` — ${payload.subject}` : ""}`,
          "",
          payload.message,
          "",
          `From: ${payload.name}`,
          `Email: ${email}`,
          payload.phone ? `Phone: ${payload.phone}` : null,
          addressText ? `Post to: ${addressText}` : null,
          payload.mailingList ? "Asked to join the mailing list." : null,
        ]
          .filter((l) => l !== null)
          .join("\n"),
      });
    } catch (err) {
      console.error("[enquiry] email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
