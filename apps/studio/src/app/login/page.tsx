import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { createServiceClient } from "@/lib/supabase";
import { verifyTurnstile } from "@/lib/turnstile";
import { Turnstile } from "@/components/turnstile";
import { PasskeyLogin } from "@/components/passkey-login";
import { safeNextPath } from "@/lib/auth-rules";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { passwordSignIn } from "./password-sign-in";
import { clientIp, loginErrorMessage, runPasswordSignIn, signInLimits, withinSignInLimits } from "./sign-in";

/**
 * Whether this password sign-in may go on to the auth server (limits and
 * reasons in ./sign-in.ts). Like the shared limiter, it lets the attempt
 * through when the limiter cannot be reached, so sign-in never depends on it.
 */
async function signInAllowed(ip: string | null): Promise<boolean> {
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (err) {
    console.error("[login] attempt limit skipped:", err);
    return true;
  }
  return withinSignInLimits(signInLimits("studio", ip, hashKey), (key, windowSeconds, max) =>
    rateLimit(service, key, windowSeconds, max),
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error: errorCode, next: rawNext } = await searchParams;
  // ?error= carries a short code shown as fixed text (./sign-in.ts); any
  // other value shows nothing.
  const error = loginErrorMessage(typeof errorCode === "string" ? errorCode : null);
  // The page that sent the user here (middleware ?next=), if it is a plain
  // path on this site; anything else signs in to the dashboard as before.
  const next = safeNextPath(rawNext);

  // Declared here so it carries `next` without a new form field; Next.js
  // encrypts the captured value into the action.
  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const token = String(formData.get("cf-turnstile-response") ?? "");
    const back = safeNextPath(next);
    const keepNext = back ? `&next=${encodeURIComponent(back)}` : "";
    const ip = clientIp(await headers());

    // The form requires both; an empty one is junk posted to the action, and
    // the auth server would count it before refusing it.
    if (!email.trim() || !password) redirect(`/login?error=credentials${keepNext}`);

    // Bot mitigation first: the Cloudflare token is verified before anything
    // is counted or the auth server is asked (order and reasons in
    // ./sign-in.ts). The token is used up by this check, so the sign-in goes
    // to the auth server with the service-role key (./password-sign-in.ts).
    const failure = await runPasswordSignIn({
      check: () => verifyTurnstile(token, ip),
      count: () => signInAllowed(ip),
      signIn: () => passwordSignIn(email, password),
    });
    if (failure) redirect(`/login?error=${failure}${keepNext}`);
    redirect(back ?? "/");
  }

  // Native inputs in the .field look under Field (ids passed to both), so
  // the ui:guard baseline of this form stays as it was.
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-6">
      <form action={signIn} className="panel w-full max-w-sm p-6 sm:p-8">
        <p className="text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent">Joost van den Bergh</p>
        <h1 className="mt-4 text-title text-ink">Sign in</h1>
        <p className="mt-1 text-[13px] text-meta">Inventory · CRM · Website</p>
        {error ? (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        ) : null}
        <div className="mt-6">
          <PasskeyLogin next={next} />
        </div>
        <div className="mt-4 space-y-4">
          <Field id="login-email" label="Email">
            <input
              id="login-email"
              name="email"
              type="email"
              required
              autoComplete="username webauthn"
              className="field"
            />
          </Field>
          <Field id="login-password" label="Password">
            <input
              id="login-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="field"
            />
          </Field>
        </div>
        <Turnstile className="mt-5" />
        <Button type="submit" variant="primary" className="mt-6 w-full" pendingLabel="Signing in…">
          Sign in
        </Button>
        <p className="mt-4 text-[12px] leading-[1.4] text-meta">
          Access is by invitation only. Ask an administrator for an invitation.
        </p>
      </form>
    </main>
  );
}
