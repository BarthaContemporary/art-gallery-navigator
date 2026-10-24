import { createHash } from "node:crypto";
import type { ConsentEvidence } from "./consent-evidence";

/*
 * The record-keeping half of the website's double opt-in
 * (lib/newsletter-optin.ts): the updates that start, move or drop a request
 * to join the mailing list on a contact's record. Pure and free of path
 * aliases, so `node --test` runs optin-evidence.test.ts against it directly.
 *
 * Where a request lives:
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
 *
 * A pending entry whose link has expired is dropped the next time the
 * website deals with the contact (a form given its address, or the link
 * opened), so the request's IP hash, browser and page do not stay on the
 * record for good after the request has lapsed.
 */

/** How long a confirmation link works: as long as an unconfirmed sign-up is kept. */
export const CONFIRM_LINK_DAYS = 30;

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

export const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Whether a request made at `at` (an ISO time) has a link that no longer works; a missing time counts as expired. */
export function linkExpired(at: unknown, nowMs: number): boolean {
  return !(Date.parse(String(at ?? "")) > nowMs - CONFIRM_LINK_DAYS * 86_400_000);
}

/** The evidence without its pending request, when that request's link has expired. */
function withoutExpiredPending(evidence: Record<string, unknown>, nowMs: number): Record<string, unknown> {
  if (!("marketing_pending" in evidence) || !linkExpired(asObject(evidence.marketing_pending).at, nowMs)) return evidence;
  const { marketing_pending: _lapsed, ...rest } = evidence;
  return rest;
}

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
 * nothing else on the contact changes. A lapsed pending entry goes either
 * way.
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
      consent_evidence: { ...withoutExpiredPending(asObject(contact.consent_evidence), Date.parse(now)), marketing: evidence },
    };
  }
  const { rest } = splitSignUpRequest(contact);
  return {
    ...(contact.consent_confirm_token ? { consent_confirm_token: null, consent_confirm_sent_at: null } : {}),
    consent_evidence: { ...rest, marketing_pending: { ...evidence, token_hash: confirmTokenHash(token) } },
  };
}

/**
 * Drops a pending request whose link has expired, for a form that has no
 * new request to make for this contact. Null when there is nothing to drop.
 */
export function expiredPendingPatch(contact: OptInContact, nowMs = Date.now()): Record<string, unknown> | null {
  const evidence = asObject(contact.consent_evidence);
  const kept = withoutExpiredPending(evidence, nowMs);
  return kept === evidence ? null : { consent_evidence: kept };
}

/**
 * For a sign-up the newsletter box created that now sends an enquiry or
 * books a visit: the contact has become a client relationship, so its open
 * request moves from the column to a pending entry (its emailed link keeps
 * working) and the retention job no longer treats it as an abandoned
 * sign-up, which it would delete, offers and all, once the enquiry or
 * appointment had itself been deleted. A request whose link has already
 * expired is dropped instead of moved, as is a lapsed pending entry on any
 * contact. Null when there is nothing to change.
 */
export function settleSignUpPatch(contact: OptInContact, nowMs = Date.now()): Record<string, unknown> | null {
  if (!contact.consent_confirm_token) return expiredPendingPatch(contact, nowMs);
  const { rest, request } = splitSignUpRequest(contact);
  const kept = withoutExpiredPending(rest, nowMs);
  const moved = {
    form: "newsletter",
    at: contact.consent_confirm_sent_at,
    ...request,
    token_hash: confirmTokenHash(contact.consent_confirm_token),
  };
  return {
    consent_confirm_token: null,
    consent_confirm_sent_at: null,
    consent_evidence: linkExpired(moved.at, nowMs) ? kept : { ...kept, marketing_pending: moved },
  };
}
