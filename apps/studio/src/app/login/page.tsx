import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-[14px] border border-line bg-cell p-8"
      >
        <h1 className="text-[22px] font-semibold text-ink-strong">JVB Studio</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Inventory · CRM · Website
        </p>
        {error ? (
          <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            {error}
          </p>
        ) : null}
        <label className="mt-6 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink"
          />
        </label>
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink"
          />
        </label>
        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-fg"
        >
          Sign in
        </button>
        <p className="mt-4 text-[12px] text-ink-soft">
          Access is invite-only. Ask an administrator for an invitation.
        </p>
      </form>
    </main>
  );
}
