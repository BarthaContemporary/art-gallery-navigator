import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed grants for gated offer pages. A grant is an HMAC over the recipient
 * token plus an expiry, so it can be handed out as a cookie (after unlocking
 * with the password) or as a short-lived magic link in an email. No DB row is
 * needed — verification is purely cryptographic.
 */

function secret(): string {
  return (
    process.env.OFFER_ACCESS_SECRET ||
    process.env.SYNC_SHARED_SECRET ||
    process.env.SANITY_REVALIDATE_SECRET ||
    "insecure-dev-only-offer-secret"
  );
}

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Cookie name for a given token — tokens are hex, so this is filesystem-safe. */
export function grantCookieName(token: string): string {
  return `oa_${token.slice(0, 40)}`;
}

/** Sign `{token, exp}` and return a compact `exp.mac` string. */
export function signGrant(token: string, ttlSeconds: number, nowMs: number): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const mac = b64url(createHmac("sha256", secret()).update(`${token}.${exp}`).digest());
  return `${exp}.${mac}`;
}

/** Verify a grant string against a token; false if malformed, wrong, or expired. */
export function verifyGrant(token: string, value: string | undefined, nowMs: number): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expStr = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false;
  const expected = b64url(
    createHmac("sha256", secret()).update(`${token}.${exp}`).digest(),
  );
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const GRANT_TTL_SECONDS = 60 * 60 * 12; // 12h once unlocked
export const MAGIC_TTL_SECONDS = 60 * 30; // 30 min for an emailed link
