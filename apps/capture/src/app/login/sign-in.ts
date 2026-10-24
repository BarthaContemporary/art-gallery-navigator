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
