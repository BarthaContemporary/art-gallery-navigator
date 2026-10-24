/**
 * The pure rules behind the passkey routes: no Next.js, no database, so
 * node --test can check them (passkey-rules.test.ts). The capture app has a
 * copy at apps/capture/src/lib/passkey-rules.ts; the same test checks both.
 */

/**
 * How long a challenge stays usable between the options call and the verify
 * call. The webauthn_challenges row expires after the same five minutes on
 * the database's own clock (migration 0092); the cookie carrying its id is
 * given the same life.
 */
export const CHALLENGE_SECONDS = 300;

/**
 * A passkey may be added only this soon after signing in. A passkey keeps
 * signing its holder in, so enrolling one needs proof that the person at the
 * keyboard knows the password (or holds a passkey), not just a live session
 * someone may have borrowed (security review 2026-10, finding F20).
 */
export const FRESH_SIGN_IN_SECONDS = 600;

export type ChallengePurpose = "register" | "login";

/**
 * The cookie that carries a challenge's id. Over HTTPS it is a __Host-
 * cookie, which a browser only accepts from this exact host, without a
 * Domain: script on a sibling subdomain cannot plant or overwrite it. Plain
 * http (local development) cannot use the prefix.
 */
export function challengeCookieName(purpose: ChallengePurpose, secure: boolean): string {
  return `${secure ? "__Host-" : ""}pk_${purpose}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A challenge id as the database issues them (a uuid); nothing else is worth a lookup. */
export function isChallengeId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * True when a request's Origin header is the app's own origin. Browsers send
 * Origin with every POST, so a page on another site, or on a sibling
 * subdomain (which shares the session cookies' site), shows up as itself; a
 * missing or "null" Origin is refused.
 */
export function isSameOrigin(originHeader: string | null | undefined, expectedOrigin: string): boolean {
  if (!originHeader) return false;
  try {
    return new URL(originHeader).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * When this session signed in, in seconds since 1970: the newest timestamp in
 * the access token's `amr` claim. The auth server records there how and when
 * the session was signed in (password, one-time link, recovery link; a
 * passkey sign-in arrives as a one-time link) and keeps it when the token is
 * refreshed, so it belongs to this browser's session, not to the account: a
 * sign-in on another device does not make a borrowed session look fresh.
 * Only a token with no timestamps at all (the auth server has always sent
 * them so far) falls back to the account's last sign-in.
 */
export function sessionSignedInAt(claims: unknown, lastSignInAt?: string | null): number | null {
  const amr = (claims as { amr?: unknown } | null | undefined)?.amr;
  let newest: number | null = null;
  if (Array.isArray(amr)) {
    for (const entry of amr) {
      const { method, timestamp } = (entry ?? {}) as { method?: unknown; timestamp?: unknown };
      // A refresh is not a sign-in, should a server ever list one.
      if (method === "token_refresh") continue;
      if (typeof timestamp === "number" && Number.isFinite(timestamp) && (newest === null || timestamp > newest))
        newest = timestamp;
    }
  }
  if (newest !== null) return newest;
  if (lastSignInAt) {
    const ms = Date.parse(lastSignInAt);
    if (Number.isFinite(ms)) return Math.floor(ms / 1000);
  }
  return null;
}

/** True when a sign-in at `signedInAt` (seconds since 1970) is recent enough to add a passkey. */
export function isFreshSignIn(signedInAt: number | null, nowMs: number = Date.now()): boolean {
  if (signedInAt === null) return false;
  return nowMs / 1000 - signedInAt <= FRESH_SIGN_IN_SECONDS;
}

/** What the enrolment routes answer when the sign-in is too old. */
export const REAUTH_MESSAGE = `For your security, a passkey can only be added within ${
  FRESH_SIGN_IN_SECONDS / 60
} minutes of signing in. Sign in again, then add it.`;
