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

  const [pieces, inStock, contacts, needs, reserved, onExport] = await Promise.all([
    supabase.from("pieces").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "in_stock"),
    supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
    supabase
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("needs_completion", true),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "reserved"),
    supabase
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("on_temp_export", true),
  ]);

  const stats = [
    { label: "Records", value: pieces.count ?? 0, href: "/inventory" },
    { label: "In stock", value: inStock.count ?? 0, href: "/inventory?status=in_stock" },
    { label: "Contacts", value: contacts.count ?? 0, href: "/crm/contacts" },
  ];

  // Triage — the few states that want a human. Only non-empty ones show.
  const triage = [
    {
      label: "Need completion",
      hint: "Missing key catalogue fields",
      value: needs.count ?? 0,
      href: "/inventory?needs=1",
    },
    {
      label: "Reserved",
      hint: "Pending sales to follow up",
      value: reserved.count ?? 0,
      href: "/inventory?status=reserved",
    },
    {
      label: "On temporary export",
      hint: "Out on loan — track return",
      value: onExport.count ?? 0,
      href: "/inventory?loan=1",
    },
  ].filter((t) => t.value > 0);

  return (
    <div>
      {/* Needs attention — triage cockpit. Hidden entirely when all clear. */}
      {triage.length > 0 ? (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span aria-hidden className="inline-block h-[7px] w-[7px] rounded-full bg-warn" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-label">
              Needs attention
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {triage.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className="jvb-pop-enter group rounded-[11px] border border-warn-soft bg-warn-soft/40 px-4 py-3.5 transition-colors hover:border-warn"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink-strong">{t.label}</span>
                  <span className="font-mono text-[22px] leading-none text-ink-strong">{t.value}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-muted">{t.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

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
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatPanel title="Objects added" metric="added" />
          <StatPanel title="Total sales" metric="sales" />
          <StatPanel title="Net profit" metric="profit" />
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WebsitePanel />
        <NationalityPie />
      </div>

      {isAdmin ? (
        <div className="mt-4">
          <BackupPanel />
        </div>
      ) : null}
    </div>
  );
}
