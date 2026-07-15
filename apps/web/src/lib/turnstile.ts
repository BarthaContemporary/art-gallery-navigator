/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Fail-open by design when `TURNSTILE_SECRET_KEY` is not configured, so the
 * public forms keep working until the keys are added to the environment.
 * Once the secret is set, a missing/invalid token is rejected.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true }; // not configured yet — don't block

  if (!token) return { ok: false, error: "Please complete the anti-spam check." };

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
    if (data.success) return { ok: true };
    return { ok: false, error: "Anti-spam check failed. Please try again." };
  } catch {
    // If Cloudflare is unreachable, don't strand a legitimate visitor.
    return { ok: true };
  }
}
