import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { createServiceClient, getSupabase } from "@/lib/supabase";
import { PasskeySignIn } from "@/components/passkey-signin";
import {
  authServerChecksCaptcha,
  clientIp,
  loginErrorFromAuth,
  loginErrorMessage,
  signInLimits,
  withinSignInLimits,
} from "./sign-in";
import { Turnstile } from "./turnstile";

/**
 * Whether this password sign-in may go on to the auth server (limits and
 * reasons in ./sign-in.ts). Like the shared limiter, it lets the attempt
 * through when the limiter cannot be reached, so sign-in never depends on it.
 */
async function signInAllowed(ip: string | null, email: string): Promise<boolean> {
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (err) {
    console.error("[login] attempt limit skipped:", err);
    return true;
  }
  return withinSignInLimits(signInLimits("capture", ip, email, hashKey), (key, windowSeconds, max) =>
    rateLimit(service, key, windowSeconds, max),
  );
}

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // The form requires both; an empty one is junk posted to the action, and
  // the auth server would count it before refusing it.
  if (!email.trim() || !password) redirect("/login?error=credentials");
  // When the auth server checks Turnstile (AUTH_SERVER_CAPTCHA), it needs the
  // widget's token with the sign-in request; without one GoTrue would only
  // refuse the attempt after counting it, so it stops here. Unset, capture
  // signs in without a check, as before.
  const serverChecks = authServerChecksCaptcha();
  const token = serverChecks ? String(formData.get("cf-turnstile-response") ?? "") : "";
  if (serverChecks && !token) redirect("/login?error=check-missing");
  // Capture has no security check of its own, so this count is what holds
  // back attempts posted straight to this action.
  if (!(await signInAllowed(clientIp(await headers()), email))) redirect("/login?error=rate-limited");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: token ? { captchaToken: token } : undefined,
  });
  if (error) redirect(`/login?error=${loginErrorFromAuth(error, Boolean(token))}`);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  // ?error= carries a short code shown as fixed text (./sign-in.ts); any
  // other value shows nothing.
  const error = loginErrorMessage(typeof errorCode === "string" ? errorCode : null);
  return (
    <main className="safe-top safe-bottom flex min-h-dvh items-center justify-center p-6">
      <form action={signIn} className="w-full max-w-sm rounded-[16px] border border-line bg-cell p-7">
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-ink-strong">
          JvB Capture
        </h1>
        <p className="mt-1 text-[13px] text-ink-muted">Quick entry — works, invoices, contacts</p>
        {error ? (
          <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            {error}
          </p>
        ) : null}
        <PasskeySignIn />
        <label className="mt-6 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="mt-1.5 w-full rounded-xl border border-line-control bg-control px-3 py-3 text-ink"
          />
        </label>
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-xl border border-line-control bg-control px-3 py-3 text-ink"
          />
        </label>
        {authServerChecksCaptcha() ? <Turnstile className="mt-5" /> : null}
        <button
          type="submit"
          className="tap mt-6 w-full rounded-xl bg-primary px-4 font-semibold text-primary-fg"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
