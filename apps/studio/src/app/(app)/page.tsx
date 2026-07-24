import Link from "next/link";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { StatPanel } from "@/components/stat-panel";
import { WebsitePanel } from "@/components/website-panel";
import { NationalityPie } from "@/components/nationality-pie";
import { BackupPanel } from "@/components/backup-panel";

export default async function Dashboard() {
  const supabase = await getSupabase();
  const session = await getSession();
  const isAdmin = session ? hasRole(session.roles, "admin") : false;

  const [pieces, inStock, contacts] = await Promise.all([
    supabase.from("pieces").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "in_stock"),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Records", value: pieces.count ?? 0, href: "/inventory" },
    { label: "In stock", value: inStock.count ?? 0, href: "/inventory?status=in_stock" },
    { label: "Contacts", value: contacts.count ?? 0, href: "/crm/contacts" },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[11px] border border-line bg-line sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-cell px-4 py-4 hover:bg-control">
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-[26px] text-ink-strong">{s.value}</div>
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatPanel title="Objects added" metric="added" />
            <StatPanel title="Total sales" metric="sales" />
            <StatPanel title="Net profit" metric="profit" />
          </div>
          <div className="mt-4">
            <BackupPanel />
          </div>
        </>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WebsitePanel />
        <NationalityPie />
      </div>
    </div>
  );
}
