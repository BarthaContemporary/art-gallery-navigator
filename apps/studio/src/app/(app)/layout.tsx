import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/makers", label: "Makers" },
  { href: "/locations", label: "Locations" },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/lists", label: "Lists" },
  { href: "/offers", label: "Offers" },
  { href: "/stock-book", label: "Stock book", roles: ["admin", "accountant"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
] as const;

async function signOut() {
  "use server";
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user, roles } = session;

  const items = NAV.filter(
    (n) => !("roles" in n) || hasRole(roles, ...(n.roles as readonly ("admin" | "accountant")[])),
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--jvb-bg-header)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center gap-4 overflow-x-auto px-4 py-3 md:px-8">
          <Link
            href="/"
            className="shrink-0 font-mono text-[12px] font-medium tracking-[0.08em] text-ink-strong"
          >
            JVB
          </Link>
          <nav className="flex items-center gap-1">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-mid hover:bg-control-active"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="ml-auto shrink-0">
            <button
              type="submit"
              className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid"
              title={user.email ?? undefined}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
