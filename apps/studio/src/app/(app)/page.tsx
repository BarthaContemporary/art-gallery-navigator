import Link from "next/link";
import { Suspense } from "react";
import { getSupabase, getSession, hasRole } from "@/lib/supabase";
import { StatPanel } from "@/components/stat-panel";
import { WebsitePanel } from "@/components/website-panel";
import { NationalityPie } from "@/components/nationality-pie";
import { BackupPanel } from "@/components/backup-panel";
import { UpcomingEventsPanel } from "@/components/upcoming-events-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, formatDate } from "@/lib/format";

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
      hint: "Out on loan, track the return",
      value: onExport.count ?? 0,
      href: "/inventory?loan=1",
    },
    // Admin only: purchase figures are entered on the financials panel, which
    // only admins can edit — anyone else would be sent to a list they can't
    // act on (and under invoker RLS staff see a count of 0 anyway).
    ...(isAdmin
      ? [
          {
            label: "Needs purchase £",
            hint: "Sold, enter the real purchase cost",
            value: noPurchase.count ?? 0,
            href: "/inventory?nopurchase=1",
          },
        ]
      : []),
  ].filter((t) => t.value > 0);

  // One stagger sequence across the whole page: triage cards, then the headline
  // stats, then the panels below. 60ms apart reads as a cascade without the
  // last card feeling late.
  const base = (triage.length + stats.length) * 60;

  // Columns follow the number of figures, so three or four fill the grid with
  // no empty cell (the "Not JvdB" figure only shows once that register is in
  // use): three in a row at every width, four as two by two until there is
  // room for one row. Literal class names, so Tailwind sees them.
  const statCols = stats.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3";

  return (
    <div>
      <PageHeader title="Dashboard" meta={formatDate(new Date(), "long", { weekday: true })} />

      {/* Needs attention: the few states that want a person. Hidden entirely
          when all is clear. */}
      {triage.length > 0 ? (
        <Section title="Needs attention" className="mb-6">
          {/* Wrapping flex, not a fixed grid: three or four cards share the row evenly. */}
          <div className="flex flex-wrap gap-3">
            {triage.map((t, i) => (
              <Link
                key={t.label}
                href={t.href}
                style={{ "--jvb-stagger": `${i * 60}ms` } as React.CSSProperties}
                // The warn rule marks these as needing attention (the heading
                // says so in words); hover is an ink edge, which keeps the
                // meta hint on the page ground.
                className="jvb-rise group min-w-[200px] flex-1 basis-[220px] border border-l-[3px] border-rule border-l-warn px-4 py-3 transition-colors hover:border-ink hover:border-l-warn"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium text-ink">{t.label}</span>
                  <span className="tabular text-[22px] font-light leading-none text-ink">{formatCount(t.value)}</span>
                </div>
                <p className="mt-1 text-[12px] leading-[1.4] text-meta">{t.hint}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Headline figures on hairlines: a row of four columns or three. */}
      <div className={`grid gap-px border-y border-rule-strong bg-rule ${statCols}`}>
        {stats.map((s, i) => (
          <Link
            key={s.label}
            href={s.href}
            style={{ "--jvb-stagger": `${triage.length * 60 + i * 60}ms` } as React.CSSProperties}
            className="jvb-rise group bg-page px-4 py-4 transition-colors hover:bg-band"
          >
            {/* body while hovered: meta is not readable on band (spec R3) */}
            <div className="label group-hover:text-body">{s.label}</div>
            <div className="tabular mt-1.5 text-[26px] font-light leading-[1.15] text-ink">{formatCount(s.value)}</div>
          </Link>
        ))}
      </div>

      {isAdmin ? (
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
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

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
        <div
          style={{ "--jvb-stagger": `${base + 200}ms` } as React.CSSProperties}
          className="jvb-rise min-w-0"
        >
          <WebsitePanel />
        </div>
        <div
          style={{ "--jvb-stagger": `${base + 260}ms` } as React.CSSProperties}
          className="jvb-rise min-w-0"
        >
          <NationalityPie />
        </div>
      </div>

      <div
        style={{ "--jvb-stagger": `${base + 320}ms` } as React.CSSProperties}
        className="jvb-rise mt-6"
      >
        {/* Streams in so a slow calendar server never holds up the dashboard. */}
        <Suspense
          fallback={
            <Section title="Next 10 days">
              <div role="status" className="space-y-2 py-1">
                <span className="sr-only">Loading</span>
                <Skeleton width="40%" />
                <Skeleton width="55%" />
                <Skeleton width="30%" />
              </div>
            </Section>
          }
        >
          <UpcomingEventsPanel />
        </Suspense>
      </div>

      {isAdmin ? (
        <div
          style={{ "--jvb-stagger": `${base + 380}ms` } as React.CSSProperties}
          className="jvb-rise mt-6"
        >
          <BackupPanel />
        </div>
      ) : null}
    </div>
  );
}
