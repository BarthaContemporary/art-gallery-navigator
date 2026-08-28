import Link from "next/link";
import { Suspense } from "react";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { StatPanel } from "@/components/stat-panel";
import { WebsitePanel } from "@/components/website-panel";
import { NationalityPie } from "@/components/nationality-pie";
import { BackupPanel } from "@/components/backup-panel";
import { UpcomingEventsPanel } from "@/components/upcoming-events-panel";
import { CountUp } from "@/components/count-up";

export default async function Dashboard() {
  const supabase = await getSupabase();
  const session = await getSession();
  const isAdmin = session ? hasRole(session.roles, "admin") : false;

  // Headline figures are JvdB stock only — reading `pieces` gives that for
  // free, since non-JvdB works live in their own table. The external register
  // gets its own figure rather than being folded into these.
  const [pieces, inStock, contacts, needs, reserved, onExport, external, noPurchase] = await Promise.all([
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
      .eq("ledger", "jvb")
      .eq("needs_completion", true),
    supabase
      .from("pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "reserved"),
    supabase
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("ledger", "jvb")
      .eq("on_temp_export", true),
    supabase
      .from("external_pieces")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    // Sold works whose mis-recorded purchase £ was cleared (migration 0066)
    // and still needs the real figure — the stock book can't show margin or
    // VAT-due for them until it's entered.
    supabase
      .from("vw_pieces_list")
      .select("id", { count: "exact", head: true })
      .eq("missing_purchase_gbp", true),
  ]);

  const stats = [
    { label: "Records", value: pieces.count ?? 0, href: "/inventory" },
    { label: "In stock", value: inStock.count ?? 0, href: "/inventory?status=in_stock" },
    { label: "Contacts", value: contacts.count ?? 0, href: "/crm/contacts" },
    // Only worth a tile once the register is actually in use.
    ...((external.count ?? 0) > 0
      ? [
          {
            label: "Not JvdB",
            value: external.count ?? 0,
            href: "/inventory?ledger=external",
          },
        ]
      : []),
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
    {
      label: "Needs purchase £",
      hint: "Sold — enter the real purchase cost",
      value: noPurchase.count ?? 0,
      href: "/inventory?nopurchase=1",
    },
  ].filter((t) => t.value > 0);

  // One stagger sequence across the whole page: triage cards, then the headline
  // stats, then the panels below. 60ms apart reads as a cascade without the
  // last card feeling late.
  const base = (triage.length + stats.length) * 60;

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
            {triage.map((t, i) => (
              <Link
                key={t.label}
                href={t.href}
                style={{ "--jvb-stagger": `${i * 60}ms` } as React.CSSProperties}
                className="jvb-rise jvb-lift group rounded-[11px] border border-warn-soft bg-warn-soft/40 px-4 py-3.5 transition-colors hover:border-warn"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-ink-strong">{t.label}</span>
                  <CountUp
                    value={t.value}
                    className="font-mono text-[22px] leading-none text-ink-strong"
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-ink-muted">{t.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[11px] border border-line bg-line sm:grid-cols-3">
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            style={{ "--jvb-stagger": `${triage.length * 60 + i * 60}ms` } as React.CSSProperties}
            className="jvb-rise bg-cell px-4 py-4 transition-colors hover:bg-control"
          >
            <div className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {s.label}
            </div>
            <CountUp value={s.value} className="mt-1 block font-mono text-[26px] text-ink-strong" />
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              ["Objects added", "added"],
              ["Total sales", "sales"],
              ["Net profit", "profit"],
            ] as const
          ).map(([title, metric], i) => (
            <div
              key={metric}
              style={{ "--jvb-stagger": `${base + i * 60}ms` } as React.CSSProperties}
              className="jvb-rise"
            >
              <StatPanel title={title} metric={metric} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          style={{ "--jvb-stagger": `${base + 200}ms` } as React.CSSProperties}
          className="jvb-rise"
        >
          <WebsitePanel />
        </div>
        <div
          style={{ "--jvb-stagger": `${base + 260}ms` } as React.CSSProperties}
          className="jvb-rise"
        >
          <NationalityPie />
        </div>
      </div>

      <div
        style={{ "--jvb-stagger": `${base + 320}ms` } as React.CSSProperties}
        className="jvb-rise mt-4"
      >
        {/* Streams in so a slow calendar server never holds up the dashboard. */}
        <Suspense
          fallback={
            <div className="rounded-[11px] border border-line bg-cell p-4">
              <h2 className="text-[13px] font-semibold text-ink-strong">Next 10 days</h2>
              <p className="mt-3 text-[12.5px] text-ink-muted">Loading…</p>
            </div>
          }
        >
          <UpcomingEventsPanel />
        </Suspense>
      </div>

      {isAdmin ? (
        <div
          style={{ "--jvb-stagger": `${base + 380}ms` } as React.CSSProperties}
          className="jvb-rise mt-4"
        >
          <BackupPanel />
        </div>
      ) : null}
    </div>
  );
}
