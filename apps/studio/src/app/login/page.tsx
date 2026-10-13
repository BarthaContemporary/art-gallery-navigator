import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSupabase } from "@/lib/supabase";
import { verifyTurnstile } from "@/lib/turnstile";
import { Turnstile } from "@/components/turnstile";
import { PasskeyLogin } from "@/components/passkey-login";
import { safeNextPath } from "@/lib/auth-rules";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  // The page that sent the user here (middleware ?next=), if it is a plain
  // path on this site; anything else signs in to the dashboard as before.
  const next = safeNextPath(rawNext);

  // Declared here so it carries `next` without a new form field; Next.js
  // encrypts the captured value into the action.
  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const back = safeNextPath(next);
    const keepNext = back ? `&next=${encodeURIComponent(back)}` : "";

    // Bot mitigation: verify the Turnstile token before touching auth.
    const h = await headers();
    const turnstile = await verifyTurnstile(
      String(formData.get("cf-turnstile-response") ?? ""),
      h.get("cf-connecting-ip") ?? h.get("x-forwarded-for"),
    );
    if (!turnstile.ok) {
      redirect(`/login?error=${encodeURIComponent(turnstile.error ?? "Security check failed")}${keepNext}`);
    }

    const supabase = await getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect(`/login?error=${encodeURIComponent(error.message)}${keepNext}`);
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
