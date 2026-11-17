import type { SupabaseClient } from "@supabase/supabase-js";

/*
 * The send log (email_events) of the newsletter and offer sends.
 *
 * Written with the service client: RLS lets staff read email_events but gives
 * only admins a write policy, so rows written with a staff member's own
 * client were refused without a word, and a staff send left no "sent" or
 * "failed" record (and the offer page lost the reason a send was refused).
 * A write policy for staff would also let them write any event ("opened",
 * say), so the rows go through here instead, after the caller's own session
 * and role check, with ids the server derived and never form input. The
 * payload keeps the masked detail (emailErrorDetail), never an address.
 *
 * A failed write is logged, not thrown: it must not stop a send that is half
 * done, whose recipient rows already record who was mailed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export type EmailEventRow = {
  event_type: "sent" | "failed";
  payload: Record<string, unknown>;
} & ({ campaign_recipient_id: string } | { offer_recipient_id: string });

export async function logEmailEvent(svc: Db, row: EmailEventRow, label: string): Promise<void> {
  const { error } = await svc.from("email_events").insert(row as Record<string, unknown>);
  if (error) console.error(`[${label}] could not write the email_events row:`, error.message);
}
