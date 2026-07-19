import { redirect } from "next/navigation";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";
import { AppHeader } from "@/components/app-header";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/library", label: "Inventory Lists & Docs" },
  { href: "/crm/contacts", label: "Contacts" },
  { href: "/crm/lists", label: "Contact list" },
  { href: "/crm/campaigns", label: "Newsletter" },
  { href: "/offers", label: "Offers" },
  { href: "/appointments", label: "Appointments" },
  { href: "/analytics", label: "Analytics" },
  { href: "/stock-book", label: "Stock book", roles: ["admin", "accountant"] },
  { href: "/admin", label: "Admin" },
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
      <AppHeader
        items={items.map((n) => ({ href: n.href, label: n.label }))}
        userEmail={user.email ?? null}
        signOut={signOut}
      />
      <main className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
