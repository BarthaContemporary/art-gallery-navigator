/**
 * When the capture app may delete a contact it added. Pure (no imports) so
 * `node --test` can load it; /api/capture/contact/[id] applies it.
 *
 * Deleting here is only an undo, for a mistaken scan or a duplicate: a
 * contact this app created (tagged 'capture'), added within the last
 * CAPTURE_CONTACT_UNDO_HOURS, and with no record under a legal hold
 * (contact_legal_holds(): a purchase, sale, consignment, order or
 * anti-money-laundering record). Anything else is an erasure, which the
 * studio does through erase_contact(), for admins only, keeping what the law
 * requires.
 */

export const CAPTURE_CONTACT_UNDO_HOURS = 48;

export const STUDIO_ERASE = "Remove it in the studio (Contacts), where an admin can erase it.";

export type Refusal = { status: 403 | 409 | 500; error: string; holds?: string[] };

/** Why this contact may not be deleted from the capture app; null if it may. */
export function contactDeleteRefusal(
  contact: { tags?: unknown; created_at?: unknown },
  now: number = Date.now(),
): Refusal | null {
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  if (!tags.includes("capture")) return { status: 403, error: "Only capture-added contacts can be deleted here" };
  const added = typeof contact.created_at === "string" ? new Date(contact.created_at).getTime() : NaN;
  if (!Number.isFinite(added) || now - added > CAPTURE_CONTACT_UNDO_HOURS * 3_600_000) {
    return {
      status: 409,
      error: `Only a contact added in the last ${CAPTURE_CONTACT_UNDO_HOURS} hours can be deleted here. ${STUDIO_ERASE}`,
    };
  }
  return null;
}

/**
 * The refusal for contact_legal_holds()'s answer: any hold refuses, and so
 * does an answer that could not be read (the check failing never deletes).
 */
export function holdRefusal(holds: unknown, failed: boolean): Refusal | null {
  if (failed || !Array.isArray(holds)) {
    return { status: 500, error: `Could not check the contact's records. ${STUDIO_ERASE}` };
  }
  const reasons = holds.filter((h): h is string => typeof h === "string" && h.trim() !== "");
  if (reasons.length === 0) return null;
  return {
    status: 409,
    error: `This contact has records the law requires us to keep: ${reasons.join("; ")}. ${STUDIO_ERASE}`,
    holds: reasons,
  };
}

/**
 * The answer when the delete itself is refused. 23503 is a conflict, not a
 * fault: either a hold appeared between the check above and the delete
 * (migration 0097's guard raises it, its message naming the holds), or a
 * record still points at the contact. Anything else is a server error.
 */
export function deleteFailure(error: { code?: string | null; message?: string | null }): Refusal {
  const message = String(error.message ?? "").trim();
  if (error.code === "23503") {
    const reason = /^This contact cannot be deleted/.test(message)
      ? message.replace(/[.\s]*$/, ".")
      : "Other records still point at this contact.";
    return { status: 409, error: `${reason} ${STUDIO_ERASE}` };
  }
  return { status: 500, error: message || "Could not delete the contact" };
}
