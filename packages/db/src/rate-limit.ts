import { createHash } from "node:crypto";

/**
 * The shared rate limiter (supabase/migrations/0089_rate_limits.sql), for
 * server code holding the service-role client: public website forms, the
 * private-offer password gate, the studio's AI routes.
 *
 *   if (!(await rateLimit(service, `newsletter:ip:${ip}`, 3600, 5))) → 429
 *
 * Keys name what is limited and by what ("<feature>:<ip|email|user>:<value>").
 * Put emails through hashKey() so the table never holds an address.
 *
 * If the check itself fails (the database is unreachable, or the migration
 * is not applied yet) the request is allowed and the failure is logged:
 * a broken limiter must not take the forms down with it.
 */
type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function rateLimit(
  service: unknown,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  try {
    const { data, error } = await (service as RpcClient).rpc("rate_limit_hit", {
      _key: key.slice(0, 300),
      _window: `${Math.max(1, Math.round(windowSeconds))} seconds`,
      _max: max,
    });
    if (error) {
      console.error(`[rate-limit] check failed for ${key.split(":")[0]}: ${error.message}`);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error(`[rate-limit] check failed for ${key.split(":")[0]}:`, err);
    return true;
  }
}

/** A short, one-way stand-in for an email (or any identifier) in a key. */
export function hashKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}
