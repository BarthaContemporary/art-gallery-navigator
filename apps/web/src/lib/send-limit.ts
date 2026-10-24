import type { createServiceClient } from "@jvb/db/server";

type Service = ReturnType<typeof createServiceClient>;

/*
 * Limits on emails the website sends to an address a visitor named but the
 * website cannot check: a newsletter confirmation, a booking confirmation,
 * a private offer's sign-in link. They count only emails actually sent.
 *
 * rateLimit() (@jvb/db/rate-limit) counts every request, refused ones
 * included, which is right for a limit on the sender (an IP address) but
 * not for one on the recipient: anyone re-submitting someone else's address
 * would keep it shut out for as long as they kept going, and its owner
 * would never get the email they asked for themselves. So these read the
 * count first and record a send only once Resend has accepted the email:
 * every send counted is an email in the recipient's own inbox.
 *
 * Kept in rate_limit_hits beside the other limits, under keys that hold
 * only a hash of the address or token, and cleared after a day. If the
 * check itself fails the email is allowed, as with every limit.
 */

/** Whether fewer than `max` emails went out under this key in the last `windowSeconds`. */
export async function withinSendLimit(supabase: Service, key: string, windowSeconds: number, max: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  try {
    const { count, error } = await supabase
      .from("rate_limit_hits")
      .select("id", { count: "exact", head: true })
      .eq("key", key)
      .gte("at", since);
    if (error) {
      console.error(`[send-limit] check failed for ${key.split(":")[0]}: ${error.message}`);
      return true;
    }
    return (count ?? 0) < max;
  } catch (err) {
    console.error(`[send-limit] check failed for ${key.split(":")[0]}:`, err);
    return true;
  }
}

/** Records one email sent under this key (see withinSendLimit). */
export async function noteSent(supabase: Service, key: string): Promise<void> {
  try {
    const { error } = await supabase.from("rate_limit_hits").insert({ key });
    if (error) console.error(`[send-limit] could not note the email sent for ${key.split(":")[0]}: ${error.message}`);
  } catch (err) {
    console.error(`[send-limit] could not note the email sent for ${key.split(":")[0]}:`, err);
  }
}
