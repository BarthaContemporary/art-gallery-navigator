/**
 * Server-side Cloudflare Turnstile verification (capture), a copy of the
 * studio's apps/studio/src/lib/turnstile.ts: change both together.
 *
 * Fail-open when `TURNSTILE_SECRET_KEY` is unset so sign-in keeps working
 * until the keys are configured for this app (docs/ops/security-runbook.md
 * step 7); fail-closed once the secret is present.
 *
 * `code` names the failure for the sign-in page, which shows fixed text per
 * code rather than whatever arrives in its URL.
 */
export type TurnstileFailure = "check-missing" | "check-failed" | "check-unavailable";

export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<{ ok: boolean; error?: string; code?: TurnstileFailure }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };

  if (!token) return { ok: false, code: "check-missing", error: "Please complete the security check." };

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success
      ? { ok: true }
      : { ok: false, code: "check-failed", error: "Security check failed. Please try again." };
  } catch {
    // Fail closed: a verification error must not silently remove bot
    // protection. A transient Cloudflare outage will surface as a retryable
    // error rather than an open door.
    return { ok: false, code: "check-unavailable", error: "Security check unavailable. Please try again." };
  }
}
