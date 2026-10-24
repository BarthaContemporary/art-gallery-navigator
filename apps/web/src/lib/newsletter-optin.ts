import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { createServiceClient } from "@jvb/db/server";
import { hashKey } from "@jvb/db/rate-limit";
import { CONSENT_TEXT_VERSION, CONSENT_TEXTS, mergeEvidence, type ConsentEvidence } from "@/lib/consent-evidence";
import { fromLine, maskAddress, sendEmail } from "@/lib/email";
import { greetingName } from "@/lib/form-fields";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName, siteUrl } from "@/lib/site";

/*
 * The double opt-in shared by the footer newsletter box (api/newsletter) and
 * the mailing-list tick on enquiries (api/enquiry), and its second step
 * (newsletter/confirm). Marketing consent is only ever switched on by the
 * owner of the address pressing "Confirm subscription" on the page the
 * emailed link opens; nothing a visitor types changes a contact's consent.
 *
 * Where the request's state lives:
 *   - a contact the newsletter box itself creates carries the token in
 *     consent_confirm_token, so apply_retention() deletes it after 30 days
 *     if it is never confirmed (and it has nothing else attached);
 *   - every other contact gets only a pending entry in its consent evidence
 *     ("marketing_pending", holding a hash of the token): one who already
 *     existed, and one an enquiry creates, whose basis is the enquiry and
 *     not a sign-up. Putting the token on such a contact would make it look
 *     like an unconfirmed sign-up to the retention job, which would delete
 *     it, opt-out, offers and all, once nothing else held it (migration
 *     0095). For the same reason a sign-up that goes on to send an enquiry
 *     or book a visit has its token moved to a pending entry
 *     (settleSignUpPatch).
 */

type Service = ReturnType<typeof createServiceClient>;

/** How long a confirmation link works: as long as an unconfirmed sign-up is kept. */
export const CONFIRM_LINK_DAYS = 30;
/** At most one confirmation (or "already subscribed") email per address in this time. */
const RESEND_HOURS = 6;

/** 24 random bytes as hex: the confirmation link's secret. */
export const CONFIRM_TOKEN = /^[a-f0-9]{48}$/;
export const newConfirmToken = () => randomBytes(24).toString("hex");
export const confirmTokenHash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** The contact columns the opt-in decides on. */
export const OPTIN_COLUMNS =
  "id, marketing_consent, unsubscribed_at, do_not_mail, consent_evidence, consent_confirm_token, consent_confirm_sent_at";
export type OptInContact = {
  id: string;
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  do_not_mail: boolean;
  consent_evidence: unknown;
  consent_confirm_token: string | null;
  consent_confirm_sent_at: string | null;
};

/** What happened to a request to join, for the staff notification. */
export type OptInOutcome = "sent" | "already" | "recent" | "suppressed" | "failed";

export const OPTIN_OUTCOME_TEXT: Record<OptInOutcome, string> = {
  sent: "Asked to join: a confirmation email was sent, and they join once they confirm",
  already: "Asked to join: already on the mailing list",
  recent: "Asked to join: a confirmation email already went to this address in the last few hours",
  suppressed: "Asked to join: not sent, the contact is marked Do not mail",
  failed: "Asked to join: the confirmation email could not be sent",
};

export function isSubscribed(c: Pick<OptInContact, "marketing_consent" | "unsubscribed_at">): boolean {
  return Boolean(c.marketing_consent) && !c.unsubscribed_at;
}

const sentKey = (email: string) => `optin:sent:${hashKey(email)}`;

/**
 * Whether an email about the newsletter (a confirmation, or the "already
 * subscribed" note) went to this address in the last RESEND_HOURS, whichever
 * form asked: at most one per address in that time, so the forms cannot be
 * used to fill a stranger's inbox from the gallery's address.
 *
 * Only emails actually sent count (noteOptInEmailSent), never a refused
 * request: someone re-submitting another person's address every few hours
 * cannot keep that address shut out, and its owner always has the one email
 * that was sent. Kept in rate_limit_hits under a hashed key, like the other
 * form limits, and cleared after a day. If the check itself fails the email
 * is allowed, as with every limit.
 */
export async function emailedRecently(supabase: Service, email: string): Promise<boolean> {
  const since = new Date(Date.now() - RESEND_HOURS * 3_600_000).toISOString();
  try {
    const { count, error } = await supabase
      .from("rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("key", sentKey(email))
      .gte("at", since);
    if (error) {
      console.error(`[newsletter] resend check failed: ${error.message}`);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (err) {
    console.error("[newsletter] resend check failed:", err);
    return false;
  }
}

/** Records that an email about the newsletter went to this address (see emailedRecently). */
export async function noteOptInEmailSent(supabase: Service, email: string): Promise<void> {
  try {
    const { error } = await supabase.from("rate_limit_hits").insert({ key: sentKey(email) });
    if (error) console.error(`[newsletter] could not note the email sent: ${error.message}`);
  } catch (err) {
    console.error("[newsletter] could not note the email sent:", err);
  }
}

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * A sign-up's own request: the newsletter box keeps it as "marketing" on the
 * contact it creates, beside the token in the column, until it is confirmed.
 * Split off so it can move to a pending entry; any other "marketing" entry
 * (a confirmed one, the legacy-import note) stays where it is.
 */
function splitSignUpRequest(contact: OptInContact): { rest: Record<string, unknown>; request: Record<string, unknown> } {
  const evidence = asObject(contact.consent_evidence);
  const marketing = asObject(evidence.marketing);
  if (contact.consent_confirm_token && marketing.form && !marketing.confirmed_at) {
    const { marketing: _request, ...rest } = evidence;
    return { rest, request: marketing };
  }
  return { rest: evidence, request: {} };
}

/**
 * The update that starts a confirmation for a contact who is already on
 * record. Only the newsletter box asking again for a contact it created
 * itself, still unconfirmed, keeps the token in the column (it stays a
 * sign-up, subject to the retention job). Otherwise the request becomes the
 * pending entry, an earlier sign-up's token leaves the column with it, and
 * nothing else on the contact changes.
 */
export function pendingPatch(
  contact: OptInContact,
  token: string,
  evidence: ConsentEvidence,
  now: string,
  { fromSignUpBox }: { fromSignUpBox: boolean },
): Record<string, unknown> {
  if (fromSignUpBox && contact.consent_confirm_token) {
    return {
      consent_confirm_token: token,
      consent_confirm_sent_at: now,
      consent_evidence: mergeEvidence(contact.consent_evidence, "marketing", evidence),
    };
  }
  const { rest } = splitSignUpRequest(contact);
  return {
    ...(contact.consent_confirm_token ? { consent_confirm_token: null, consent_confirm_sent_at: null } : {}),
    consent_evidence: mergeEvidence(rest, "marketing_pending", { ...evidence, token_hash: confirmTokenHash(token) }),
  };
}

/**
 * For a sign-up the newsletter box created that now sends an enquiry or
 * books a visit: the contact has become a client relationship, so its open
 * request moves from the column to a pending entry (its emailed link keeps
 * working) and the retention job no longer treats it as an abandoned
 * sign-up, which it would delete, offers and all, once the enquiry or
 * appointment had itself been deleted. Null when there is nothing to move.
 */
export function settleSignUpPatch(contact: OptInContact): Record<string, unknown> | null {
  if (!contact.consent_confirm_token) return null;
  const { rest, request } = splitSignUpRequest(contact);
  return {
    consent_confirm_token: null,
    consent_confirm_sent_at: null,
    consent_evidence: {
      ...rest,
      marketing_pending: {
        form: "newsletter",
        at: contact.consent_confirm_sent_at,
        ...request,
        token_hash: confirmTokenHash(contact.consent_confirm_token),
      },
    },
  };
}

type Pending = {
  id: string;
  /** The token sits in consent_confirm_token (a contact the website created). */
  inColumn: boolean;
  /** What the visitor was shown and agreed to when asking. */
  shown: Record<string, unknown>;
  evidence: Record<string, unknown>;
};

/** The open request a confirmation link belongs to; null when unknown, used or expired. */
export async function findPendingConfirmation(supabase: Service, token: string): Promise<Pending | null> {
  if (!CONFIRM_TOKEN.test(token)) return null;
  const cutoff = Date.now() - CONFIRM_LINK_DAYS * 86_400_000;

  const { data: byColumn, error } = await supabase
    .from("crm_contacts")
    .select("id, consent_evidence, consent_confirm_sent_at")
    .eq("consent_confirm_token", token)
    .maybeSingle();
  if (error) throw error;
  if (byColumn) {
    const row = byColumn as { id: string; consent_evidence: unknown; consent_confirm_sent_at: string | null };
    if (!(Date.parse(row.consent_confirm_sent_at ?? "") > cutoff)) return null;
    const evidence = asObject(row.consent_evidence);
    return { id: row.id, inColumn: true, shown: asObject(evidence.marketing_pending ?? evidence.marketing), evidence };
  }

  const { data: rows, error: pendingError } = await supabase
    .from("crm_contacts")
    .select("id, consent_evidence")
    .eq("consent_evidence->marketing_pending->>token_hash", confirmTokenHash(token))
    .limit(1);
  if (pendingError) throw pendingError;
  const row = (rows ?? [])[0] as { id: string; consent_evidence: unknown } | undefined;
  if (!row) return null;
  const evidence = asObject(row.consent_evidence);
  const shown = asObject(evidence.marketing_pending);
  if (!(Date.parse(String(shown.at ?? "")) > cutoff)) return null;
  return { id: row.id, inColumn: false, shown, evidence };
}

/**
 * The second step: the owner of the address pressed "Confirm subscription".
 * Switches marketing consent on, records the confirmation in the consent
 * evidence and retires the link. A past opt-out is lifted, since the person
 * has now asked again from their own mailbox; "Do not mail", which staff
 * set or a bounce or complaint set, is never touched. False when the link
 * was unknown, already used or expired.
 *
 * The confirmed evidence keeps what the person was shown when asking (for
 * an enquiry, only the tick's own line), the wording of the confirmation
 * page they agreed to by pressing the button, and a hash of the link, which
 * ties the confirmation to the email and lets a second press find it.
 */
export async function confirmSubscription(supabase: Service, token: string): Promise<boolean> {
  const pending = await findPendingConfirmation(supabase, token);
  if (!pending) return false;
  const now = new Date().toISOString();
  const { token_hash: _hash, ...shown } = pending.shown;
  const { marketing_pending: _pending, ...evidence } = pending.evidence;
  const update = supabase
    .from("crm_contacts")
    .update({
      marketing_consent: true,
      consent_date: now,
      consent_source: shown.form === "enquiry_mailing_list" ? "website_enquiry" : "website_newsletter",
      unsubscribed_at: null,
      consent_confirm_token: null,
      consent_evidence: {
        ...evidence,
        marketing: {
          ...shown,
          token_hash: confirmTokenHash(token),
          confirmed_at: now,
          confirmed_text: CONSENT_TEXTS.newsletter,
          confirmed_version: CONSENT_TEXT_VERSION,
        },
      },
    })
    .eq("id", pending.id);
  // Only while the link is still the current one: a second press, or a newer
  // request in between, finds nothing to do.
  const { data, error } = await (pending.inColumn
    ? update.eq("consent_confirm_token", token)
    : update.eq("consent_evidence->marketing_pending->>token_hash", confirmTokenHash(token))
  ).select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/**
 * Whether this link already confirmed a subscription that still stands: a
 * second press of the button, or the link opened again afterwards. Lets
 * both end on "You're subscribed" rather than on "This link has expired".
 */
export async function alreadyConfirmed(supabase: Service, token: string): Promise<boolean> {
  if (!CONFIRM_TOKEN.test(token)) return false;
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("marketing_consent, unsubscribed_at")
    .eq("consent_evidence->marketing->>token_hash", confirmTokenHash(token))
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as Pick<OptInContact, "marketing_consent" | "unsubscribed_at"> | undefined;
  return Boolean(row && isSubscribed(row));
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

async function newsletterEmail(
  req: NextRequest,
  to: string,
  build: (galleryName: string) => { subject: string; text: string[]; html: string },
  label: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`${label} not sent: RESEND_API_KEY missing`);
    return false;
  }
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const from = process.env.BOOKING_FROM_EMAIL ?? `website@${req.nextUrl.hostname}`;
  const address = settings?.address?.replace(/\r?\n/g, ", ");
  const { subject, text, html } = build(galleryName);
  const id = await sendEmail(apiKey, {
    from: fromLine(from, galleryName),
    to,
    subject,
    text: [...text, "", galleryName, address ?? "", `${siteUrl}/privacy`].join("\n"),
    html: `${html}
<p style="color:#666;font-size:12px">${escapeHtml(galleryName)}${address ? ` · ${escapeHtml(address)}` : ""} · <a href="${siteUrl}/privacy" style="color:#666">Privacy Notice</a></p>`,
  }, label);
  console.info(`${label} sent to ${maskAddress(to)} (Resend ${id})`);
  return true;
}

/**
 * The confirmation email. The name the visitor typed appears only as a
 * single plain word (lib/form-fields greetingName), so the form cannot be
 * used to send someone else a message of the visitor's choosing from the
 * gallery's address.
 */
export function sendConfirmation(req: NextRequest, to: string, name: string | null, token: string): Promise<boolean> {
  const greeting = greetingName(name);
  const link = `${siteUrl}/newsletter/confirm/${token}`;
  return newsletterEmail(req, to, (galleryName) => ({
    subject: `Please confirm your subscription to ${galleryName}`,
    text: [
      greeting ? `Dear ${greeting},` : "Hello,",
      "",
      `Thank you for your interest in ${galleryName}. To receive our newsletter, please open this link and press "Confirm subscription":`,
      link,
      "",
      `If you did not ask to subscribe, simply ignore this email and nothing further will be sent. The link works for ${CONFIRM_LINK_DAYS} days.`,
    ],
    html: `<p>${greeting ? `Dear ${escapeHtml(greeting)},` : "Hello,"}</p>
<p>Thank you for your interest in ${escapeHtml(galleryName)}. To receive our newsletter, please open this link and press &ldquo;Confirm subscription&rdquo;:</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px">Confirm subscription</a></p>
<p style="color:#666;font-size:13px">If you did not ask to subscribe, simply ignore this email and nothing further will be sent. The link works for ${CONFIRM_LINK_DAYS} days.</p>`,
  }), "[newsletter] confirmation");
}

/**
 * Sent instead of a confirmation when the address is already subscribed, so
 * the website answers every sign-up the same way and cannot be used to find
 * out who is on the mailing list.
 */
export function sendAlreadySubscribed(req: NextRequest, to: string, name: string | null): Promise<boolean> {
  const greeting = greetingName(name);
  return newsletterEmail(req, to, (galleryName) => ({
    subject: `You are already subscribed to ${galleryName}`,
    text: [
      greeting ? `Dear ${greeting},` : "Hello,",
      "",
      `Someone, perhaps you, asked to subscribe this address to the ${galleryName} newsletter. It is already on our list, so nothing has changed.`,
      "",
      "Every newsletter carries a link to unsubscribe. If you did not ask, you can simply ignore this email.",
    ],
    html: `<p>${greeting ? `Dear ${escapeHtml(greeting)},` : "Hello,"}</p>
<p>Someone, perhaps you, asked to subscribe this address to the ${escapeHtml(galleryName)} newsletter. It is already on our list, so nothing has changed.</p>
<p style="color:#666;font-size:13px">Every newsletter carries a link to unsubscribe. If you did not ask, you can simply ignore this email.</p>`,
  }), "[newsletter] already-subscribed note");
}
