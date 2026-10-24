import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { consentEvidence, mergeEvidence } from "@/lib/consent-evidence";
import { contactIdByEmail } from "@/lib/contacts";
import { maskAddress } from "@/lib/email";
import { clientIp } from "@/lib/form-fields";
import { oneLine } from "@/lib/form-schema";
import {
  emailedRecently,
  expiredPendingPatch,
  isSubscribed,
  newConfirmToken,
  noteOptInEmailSent,
  OPTIN_COLUMNS,
  pendingPatch,
  sendAlreadySubscribed,
  sendConfirmation,
  type OptInContact,
} from "@/lib/newsletter-optin";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: oneLine(z.string().trim().min(1, "Please enter your name").max(200)),
  email: oneLine(z.string().trim().email("Please enter a valid email address").max(320)),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree to receive the newsletter" }) }),
  turnstileToken: z.string().max(4096).optional(),
  website: z.string().optional(), // honeypot
});

/** Sign-ups from one address (an office, a fair's wifi) in an hour. */
const PER_IP_PER_HOUR = 10;

/**
 * Footer newsletter sign-up, double opt-in (ICO's recommended practice under
 * PECR reg. 22): the request is recorded with its consent evidence and a
 * confirmation link is emailed; marketing consent is only switched on when
 * the owner of the address opens that link and presses "Confirm
 * subscription" (newsletter/confirm). Sign-ups never confirmed are purged by
 * the retention job.
 *
 * Every accepted request gets the same answer, whatever the address's state,
 * so the box cannot be used to learn who is on the mailing list: someone
 * already subscribed is told so by email instead. The email goes out after
 * the answer (after()), so the answer comes back at the same point whether
 * an email is sent or not, and its timing tells nothing either. Turnstile, a
 * per-address limit of one email every few hours and a per-IP limit stop it
 * being used to send the gallery's mail to strangers (security review
 * 2026-10, F12).
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
  const accepted = NextResponse.json({ ok: true });
  if (payload.website) return accepted; // bot: pretend

  const ip = clientIp(req.headers);
  const turnstile = await verifyTurnstile(payload.turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  const email = payload.email.toLowerCase();
  const [firstName, ...rest] = payload.name.split(/\s+/);
  const evidence = consentEvidence(req, "newsletter");

  try {
    const supabase = createServiceClient();
    if (ip && !(await rateLimit(supabase, `newsletter:ip:${hashKey(ip)}`, 3600, PER_IP_PER_HOUR))) {
      return NextResponse.json({ error: "Too many sign-ups from here just now. Please try again in an hour." }, { status: 429 });
    }

    const contactId = await contactIdByEmail(supabase, email);
    let contact: OptInContact | null = null;
    if (contactId) {
      const { data, error } = await supabase.from("crm_contacts").select(OPTIN_COLUMNS).eq("id", contactId).maybeSingle();
      if (error) throw error;
      contact = data as OptInContact | null;
    }

    /** The email this request sends, if any; it goes out after the answer. */
    let send: (() => Promise<boolean>) | null = null;
    /** For a contact already on record: a new request, or else only a lapsed one dropped. */
    let patch = contact ? expiredPendingPatch(contact) : null;

    if (contact?.do_not_mail) {
      // "Do not mail" is the gallery's decision (or a bounce or complaint):
      // nothing is sent, the consent stays as it is, and the visitor sees
      // the usual answer.
      console.info(`[newsletter] ${maskAddress(email)} is marked do-not-mail; nothing sent`);
    } else if (await emailedRecently(supabase, email)) {
      console.info(`[newsletter] ${maskAddress(email)} was emailed in the last few hours; nothing sent`);
    } else if (contact && isSubscribed(contact)) {
      send = () => sendAlreadySubscribed(req, email, payload.name);
    } else {
      const token = newConfirmToken();
      const now = new Date().toISOString();
      if (contact) {
        patch = pendingPatch(contact, token, evidence, now, { fromSignUpBox: true });
      } else {
        const { error } = await supabase.from("crm_contacts").insert({
          first_name: firstName,
          last_name: rest.join(" ") || null,
          email,
          marketing_consent: false,
          consent_source: "website_newsletter",
          consent_confirm_token: token,
          consent_confirm_sent_at: now,
          consent_evidence: mergeEvidence(null, "marketing", evidence),
          tags: ["newsletter"],
        });
        if (error) throw error;
      }
      send = () => sendConfirmation(req, email, payload.name, token);
    }

    if (contact && patch) {
      const { error } = await supabase.from("crm_contacts").update(patch).eq("id", contact.id);
      if (error) throw error;
    }

    if (send) {
      const deliver = send;
      after(async () => {
        try {
          if (await deliver()) await noteOptInEmailSent(supabase, email);
        } catch (err) {
          console.error("[newsletter] email not sent:", err);
        }
      });
    }
    return accepted;
  } catch (err) {
    console.error("[newsletter] failed:", err);
    return NextResponse.json({ error: "Could not sign you up right now — please try again." }, { status: 500 });
  }
}
