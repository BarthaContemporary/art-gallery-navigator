import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, canCapture, getSupabase } from "@/lib/supabase";

async function signOut() {
  "use server";
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!canCapture(session.roles)) {
    return (
      <main className="safe-top flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-[15px] text-ink-body">
          This device is signed in as <b>{session.user.email}</b>, which is not a
          staff or admin account.
        </p>
        <form action={signOut}>
          <button className="tap rounded-xl border border-line-control bg-control px-5 font-medium text-ink-body">
            Sign out
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="safe-top safe-bottom mx-auto min-h-dvh w-full max-w-[560px]">
      <header className="flex items-center justify-between px-5 pb-2 pt-4">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em] text-ink-strong">
          JvB Capture
        </Link>
        <form action={signOut}>
          <button className="text-[12px] text-ink-soft">Sign out</button>
        </form>
      </header>
      <main className="px-5 pb-16">{children}</main>
    </div>
  );
}
