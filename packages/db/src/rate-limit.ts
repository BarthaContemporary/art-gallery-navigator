import { createHash, createHmac } from "node:crypto";

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
    // Anything but a plain yes or no is a broken check, treated as one.
    if (typeof data !== "boolean") {
      console.error(`[rate-limit] check failed for ${key.split(":")[0]}: unexpected answer`);
      return true;
    }
    return data;
  } catch (err) {
    console.error(`[rate-limit] check failed for ${key.split(":")[0]}:`, err);
    return true;
  }
}

/**
 * A short, one-way stand-in for an email, IP address or token in a key.
 * Keyed with a server secret (HMAC): a plain hash of an IPv4 address can be
 * reversed by hashing all four billion of them, a keyed one cannot without
 * the secret. RATE_LIMIT_HASH_SECRET if set, otherwise derived from the
 * service-role key every server already holds; the same value on every app,
 * so keys match across them. Rotating either only resets the counts.
 */
export function hashKey(value: string): string {
  const v = value.trim().toLowerCase();
  const secret = process.env.RATE_LIMIT_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return createHash("sha256").update(v).digest("hex").slice(0, 32);
  const key = createHmac("sha256", secret).update("jvb:rate-limit-keys").digest();
  return createHmac("sha256", key).update(v).digest("hex").slice(0, 32);
}
