import { redirect } from "next/navigation";
import { getSupabase, requireSession } from "@/lib/supabase";

async function changePassword(formData: FormData) {
  "use server";
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 10) redirect("/account?error=Password+must+be+at+least+10+characters");
  if (next !== confirm) redirect("/account?error=Passwords+do+not+match");
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  redirect("/account?ok=1");
}

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { user, roles } = await requireSession();
  const { error, ok } = await searchParams;
  return (
    <div className="max-w-md">
      <h1 className="text-[26px] font-semibold text-ink-strong">Account</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        {user.email} · {roles.join(", ") || "no role"}
      </p>

      <form action={changePassword} className="mt-6 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Change password</h2>
        {error ? (
          <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="mt-3 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
            Password updated.
          </p>
        ) : null}
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          New password
          <input name="password" type="password" required minLength={10} autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]" />
        </label>
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Confirm new password
          <input name="confirm" type="password" required minLength={10} autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px]" />
        </label>
        <button type="submit" className="mt-5 rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-fg">
          Update password
        </button>
        <p className="mt-3 text-[12px] text-ink-soft">Minimum 10 characters. You stay signed in after changing it.</p>
      </form>
    </div>
  );
}
