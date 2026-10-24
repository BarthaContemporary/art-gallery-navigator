import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Signed grants for gated offer pages. A grant is an HMAC over the recipient
 * token plus an expiry, so it can be handed out as a cookie (after unlocking
 * with the password) or as a short-lived sign-in link in an email. No DB row
 * is needed — verification is purely cryptographic.
 */

let warned = false;

/**
 * The signing key: OFFER_ACCESS_SECRET, or failing that one of the server
 * secrets this deployment already has (the live site signs with its Sanity
 * webhook secret today, so grants already handed out stay valid). There is
 * no built-in default any more: with no secret at all, nothing can be
 * unlocked rather than everything being signed with a key printed in the
 * source.
 */
function secret(): string | null {
  // Used exactly as set (not trimmed), so the key, and every grant signed
  // with it, is the same as before.
  const set = (v: string | undefined) => (v && v.trim() ? v : null);
  const key =
    set(process.env.OFFER_ACCESS_SECRET) ??
    set(process.env.SYNC_SHARED_SECRET) ??
    set(process.env.SANITY_REVALIDATE_SECRET);
  if (!key && !warned) {
    warned = true;
    console.error("[offer] no OFFER_ACCESS_SECRET (or other server secret) set: gated offers cannot be unlocked");
  }
  return key;
}

/**
 * Whether grants can be signed at all (a secret is configured). The password
 * route checks it first, so a deployment without a key answers "cannot be
 * opened just now" without counting the visitor's try.
 */
export function offerAccessConfigured(): boolean {
  return secret() !== null;
}

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Cookie name for a given token — tokens are hex, so this is filesystem-safe. */
export function grantCookieName(token: string): string {
  return `oa_${token.slice(0, 40)}`;
}

/** Sign `{token, exp}` and return a compact `exp.mac` string. Throws when no secret is set. */
export function signGrant(token: string, ttlSeconds: number, nowMs: number): string {
  const key = secret();
  if (!key) throw new Error("offer access secret not configured");
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const mac = b64url(createHmac("sha256", key).update(`${token}.${exp}`).digest());
  return `${exp}.${mac}`;
}

/** Verify a grant string against a token; false if malformed, wrong, expired or unsignable. */
export function verifyGrant(token: string, value: string | undefined, nowMs: number): boolean {
  if (!value) return false;
  const key = secret();
  if (!key) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expStr = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false;
  const expected = b64url(
    createHmac("sha256", key).update(`${token}.${exp}`).digest(),
  );
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The offer password check, in constant time: both sides are hashed first,
 * so neither the comparison's length nor where it stops tells a guesser
 * anything.
 */
export function passwordMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const GRANT_TTL_SECONDS = 60 * 60 * 12; // 12h once unlocked
export const MAGIC_TTL_SECONDS = 60 * 30; // 30 min for an emailed link
