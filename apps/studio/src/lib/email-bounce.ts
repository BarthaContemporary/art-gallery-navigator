/**
 * A bounce belongs to the address that bounced.
 *
 * The Resend webhook stamps crm_contacts.email_bounced_at when a message to
 * the contact hard-bounces (apps/web/src/app/api/resend-webhook), and offers
 * skip a contact with that stamp (offers/[id]/page.tsx). Nothing else clears
 * it, so a contact whose address is corrected would be skipped by every offer
 * from then on. The contact autosave (api/crm/contacts/[id]) therefore clears
 * the stamp when the saved address differs from the stored one, case and
 * surrounding spaces aside. The do-not-mail switch the webhook also turned on
 * is left as it is: that one the dealer switches back by hand.
 *
 * Self-contained on purpose (a type import only): node --test runs it directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** What the decision reads of the stored contact. */
export type StoredAddress = { email: string | null; email_bounced_at: string | null };

/** The update fields that go with a save: the cleared stamp, or nothing. */
export type BouncePatch = { email_bounced_at: null } | Record<string, never>;

const norm = (e: string | null | undefined) => String(e ?? "").trim().toLowerCase();

/**
 * The patch for saving `next` over `stored`: `{ email_bounced_at: null }` only
 * when a bounce is recorded and the address really changes. No stored row
 * (not read) keeps the stamp.
 */
export function bounceResetPatch(stored: StoredAddress | null, next: string | null): BouncePatch {
  if (!stored?.email_bounced_at) return {};
  return norm(stored.email) === norm(next) ? {} : { email_bounced_at: null };
}

/**
 * Reads the contact's stored address and bounce stamp, on the caller's own
 * connection, and answers bounceResetPatch. A failed read keeps the stamp
 * (`{}`): a save never clears it on a guess, and the route's own read and
 * write report the failure.
 */
export async function bounceResetFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  contactId: string,
  next: string | null,
): Promise<BouncePatch> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("email, email_bounced_at")
    .eq("id", contactId)
    .maybeSingle();
  if (error || !data) return {};
  return bounceResetPatch(data as StoredAddress, next);
}
