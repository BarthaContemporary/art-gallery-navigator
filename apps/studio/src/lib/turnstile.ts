/**
 * Server-side Cloudflare Turnstile verification (studio).
 *
 * Fail-open when `TURNSTILE_SECRET_KEY` is unset so login keeps working until
 * the keys are configured; fail-closed once the secret is present.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };

  if (!token) return { ok: false, error: "Please complete the security check." };

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
      : { ok: false, error: "Security check failed. Please try again." };
  } catch {
    // Fail closed: a verification error must not silently remove bot
    // protection. A transient Cloudflare outage will surface as a retryable
    // error rather than an open door.
    return { ok: false, error: "Security check unavailable. Please try again." };
  }
}
