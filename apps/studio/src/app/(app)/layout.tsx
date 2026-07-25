import { redirect } from "next/navigation";
import { getSession, getSupabase, hasRole } from "@/lib/supabase";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";

const NAV = [
  { href: "/", label: "Dashboard", group: "overview" },
  { href: "/inventory", label: "Inventory", group: "inventory" },
  { href: "/library", label: "Inventory Lists & Docs", group: "inventory" },
  { href: "/crm/contacts", label: "Contacts", group: "crm" },
  { href: "/crm/lists", label: "Contact list", group: "crm" },
  { href: "/crm/campaigns", label: "Newsletter", group: "crm" },
  { href: "/offers", label: "Offers", group: "crm" },
  { href: "/appointments", label: "Appointments", group: "crm" },
  { href: "/analytics", label: "Analytics", group: "ops" },
  { href: "/stock-book", label: "Stock book", roles: ["admin", "accountant"], group: "ops" },
  { href: "/admin", label: "Admin", group: "ops" },
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
        items={items.map((n) => ({ href: n.href, label: n.label, group: n.group }))}
        userEmail={user.email ?? null}
        signOut={signOut}
      />
      <CommandPalette
        navItems={items.map((n) => ({ href: n.href, label: n.label, group: n.group }))}
      />
      <main className="mx-auto max-w-[1320px] px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
