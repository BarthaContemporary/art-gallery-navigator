import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { PasskeySignIn } from "@/components/passkey-signin";
import { authServerChecksCaptcha, loginErrorFromAuth, loginErrorMessage } from "./sign-in";
import { Turnstile } from "./turnstile";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // When the auth server checks Turnstile (AUTH_SERVER_CAPTCHA), it needs the
  // widget's token with the sign-in request; unset, capture signs in without
  // a check, as before.
  const token = authServerChecksCaptcha() ? String(formData.get("cf-turnstile-response") ?? "") : "";
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
