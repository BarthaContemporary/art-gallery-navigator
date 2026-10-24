/**
 * Sign-in helpers shared by the login page's server action and its error
 * notice. Pure (no Next.js, no path aliases) so `node --test` can load it.
 * The studio and the capture app each keep this file, identical, at
 * apps/<app>/src/app/login/sign-in.ts: change both together.
 */

/**
 * Why the sign-in page was shown again. The page's ?error= carries only one
 * of these codes and shows the fixed text below, so a crafted link cannot put
 * its own words on the real sign-in page.
 */
export const LOGIN_ERRORS = {
  "check-missing": "Please complete the security check.",
  "check-failed": "Security check failed. Please try again.",
  "check-unavailable": "Security check unavailable. Please try again.",
  credentials: "Invalid email or password.",
  "rate-limited": "Too many sign-in attempts. Wait a few minutes, then try again.",
  failed: "Sign-in failed. Please try again.",
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

/** The fixed message for a ?error= code; null for anything else. */
export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code || !Object.hasOwn(LOGIN_ERRORS, code)) return null;
  return LOGIN_ERRORS[code as LoginErrorCode];
}

/**
 * True when the auth server (GoTrue) checks the Turnstile token itself
 * (AUTH_SERVER_CAPTCHA=1, set together with GOTRUE_SECURITY_CAPTCHA_ENABLED on
 * the server; docs/ops/security-runbook.md). The app must then pass the token
 * on untouched: Cloudflare accepts each token once, so verifying it here first
 * would make GoTrue's check fail.
 */
export function authServerChecksCaptcha(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.AUTH_SERVER_CAPTCHA ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/** The parts of a Supabase AuthError the mapping reads. */
type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null };

/**
 * The code for an error GoTrue returned from a password sign-in.
 * `sentToken` says whether a Turnstile token went with the request, which
 * tells "no token" apart from "Cloudflare could not be reached": GoTrue
 * answers both with the same "captcha verification process failed".
 */
export function loginErrorFromAuth(error: AuthErrorLike, sentToken: boolean): LoginErrorCode {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) return "credentials";
  if (error.status === 429 || code.startsWith("over_") || /rate limit/i.test(message)) return "rate-limited";
  if (code === "captcha_failed") return "check-failed";
  if (/captcha/i.test(message)) return sentToken ? "check-unavailable" : "check-missing";
  return "failed";
}

/**
 * How many password sign-ins the app passes on to the auth server, counted in
 * the shared limiter (@jvb/db/rate-limit) before GoTrue is called.
 *
 * GoTrue counts its own sign-in attempts per calling address, and the studio
 * and capture servers call it from a few shared Vercel addresses. That count
 * also carries every session refresh those servers make, and a refused
 * refresh signs the person out. So the apps hold attempts back first: per
 * sender's address and per email, so one person guessing is slowed, and per
 * app, so that what both apps pass on together (2 × 12) always fits inside
 * the first burst of 30 GoTrue allows an address, with room left for
 * refreshes. Someone can still use up an app's count on purpose and hold up
 * password sign-in there for a few minutes; passkeys and existing sessions
 * carry on (docs/ops/security-runbook.md, "If staff see Too many sign-in
 * attempts").
 */
export const SIGN_IN_LIMITS = {
  address: { windowSeconds: 5 * 60, max: 10 },
  email: { windowSeconds: 15 * 60, max: 10 },
  app: { windowSeconds: 5 * 60, max: 12 },
} as const;

export type SignInApp = "studio" | "capture";

/** One count for rateLimit(): at most `max` attempts per `windowSeconds` for `key`. */
export type SignInLimit = { key: string; windowSeconds: number; max: number };

/**
 * The sender's address as Vercel reports it: `x-real-ip`, or the first entry
 * of `x-forwarded-for`. Vercel sets both at its edge, replacing whatever the
 * browser sent; `cf-connecting-ip` is never read, as no Cloudflare proxy sits
 * in front and the browser could set it. Null when neither holds something
 * shaped like an address (local development). The website reads it the same
 * way (apps/web/src/lib/form-fields.ts).
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const candidates = [headers.get("x-real-ip"), headers.get("x-forwarded-for")?.split(",")[0]];
  for (const raw of candidates) {
    const ip = raw?.trim();
    if (ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip)) return ip;
  }
  return null;
}

/**
 * The part of an address the per-address count is kept for: an IPv4 address
 * as it is, an IPv6 address by its first half (its /64 network). One IPv6
 * connection is normally given a whole /64, so counting full IPv6 addresses
 * would let one sender start a fresh count with every request. Anything that
 * does not parse is counted as written.
 */
export function limitAddress(ip: string): string {
  const v = ip.trim().toLowerCase();
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v)?.[1];
  if (v4) return v4;
  const halves = v.split("::");
  if (!v.includes(":") || halves.length > 2) return v;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  // "::" stands for one or more groups of zeros.
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (halves.length === 2 && fill < 1) return v;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...tail];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return v;
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")}::/64`;
}

/**
 * The counts one password sign-in goes against, in the order they are
 * checked. Keys follow @jvb/db/rate-limit's "<feature>:<kind>:<value>"; the
 * address and the email go through `hash` (that module's hashKey), so the
 * table never holds either. Both apps share the address and email counts, so
 * switching app gives no fresh tries; each app has its own app count. Without
 * an address (local development) or an email, that count is left out.
 */
export function signInLimits(
  app: SignInApp,
  ip: string | null,
  email: string,
  hash: (value: string) => string,
): SignInLimit[] {
  const limits: SignInLimit[] = [];
  if (ip) limits.push({ key: `login:ip:${hash(limitAddress(ip))}`, ...SIGN_IN_LIMITS.address });
  const address = email.trim().toLowerCase();
  if (address) limits.push({ key: `login:email:${hash(address)}`, ...SIGN_IN_LIMITS.email });
  limits.push({ key: `login:app:${app}`, ...SIGN_IN_LIMITS.app });
  return limits;
}

/**
 * Counts one attempt against each limit in turn; true when every one allowed
 * it. Stops at the first refusal, so an attempt already refused for its
 * address does not also use up the email's or the app's count: one sender
 * can spend at most 10 of an app's 12 in any 5 minutes.
 */
export async function withinSignInLimits(
  limits: SignInLimit[],
  hit: (key: string, windowSeconds: number, max: number) => Promise<boolean>,
): Promise<boolean> {
  for (const limit of limits) {
    if (!(await hit(limit.key, limit.windowSeconds, limit.max))) return false;
  }
  return true;
}
