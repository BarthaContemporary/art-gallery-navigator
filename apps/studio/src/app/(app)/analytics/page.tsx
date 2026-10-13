import { plausibleConfig, fetchOverview } from "@/lib/plausible";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { SegmentedLinks } from "@/components/ui/chips";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const RANGES: { key: string; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "6mo", label: "6 months" },
  { key: "12mo", label: "12 months" },
];

function fmtDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

function Bars({
  rows,
  empty,
}: {
  rows: { name: string; visitors: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-body">{empty}</p>;
  }
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.name} className="relative border-b border-rule px-2 py-2">
          {/* The bar is a neutral band, so the text over it stays body and
              ink (meta is not readable on band, spec R3). */}
          <div
            className="absolute inset-y-[3px] left-0 bg-band"
            style={{ width: `${(r.visitors / max) * 100}%` }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-ink">{r.name}</span>
            <span className="tabular shrink-0 text-[12px] text-body">{formatCount(r.visitors)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const code = "bg-band px-1 text-[12.5px] text-ink";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = RANGES.some((r) => r.key === sp.range) ? (sp.range as string) : "30d";
  const cfg = plausibleConfig();
  const data = cfg ? await fetchOverview(cfg, range) : null;

  if (!cfg) {
    return (
      <div className="max-w-[var(--jvb-measure)]">
        <PageHeader title="Analytics" meta="Public website visitors (cookieless)" />
        <p className="text-[13.5px] leading-[1.5] text-body">
          Website analytics are not connected yet. Once the self-hosted Plausible instance is
          running, set <code className={code}>PLAUSIBLE_STATS_HOST</code>,{" "}
          <code className={code}>PLAUSIBLE_API_KEY</code> and{" "}
          <code className={code}>PLAUSIBLE_SITE_ID</code> in the studio&rsquo;s environment and the
          public site&rsquo;s visitor results will appear here.
        </p>
        <p className="mt-3 text-[13px] text-meta">
          Analytics run on the public website only. The studio is never tracked.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        meta={`Public website · ${process.env.PLAUSIBLE_SITE_ID ?? ""}`}
        actions={
          <SegmentedLinks
            aria-label="Period"
            current={range}
            items={RANGES.map((r) => ({ value: r.key, label: r.label, href: `/analytics?range=${r.key}` }))}
          />
        }
      />

      {!data ? (
        <Notice tone="danger">
          Couldn&rsquo;t reach Plausible. Check the host, API key and site ID, and that the instance
          is running.
        </Notice>
      ) : (
        <>
          {/* Five figures on hairlines: one row on a desktop, two columns on
              a phone with the last figure spanning both, so no cell is left
              empty. */}
          <dl className="grid grid-cols-2 gap-px border-y border-rule-strong bg-rule lg:grid-cols-5">
            {[
              ["Unique visitors", formatCount(data.totals.visitors)],
              ["Total visits", formatCount(data.totals.visits)],
              ["Pageviews", formatCount(data.totals.pageviews)],
              ["Avg. visit", fmtDuration(data.totals.visitDuration)],
              ["Bounce rate", `${Math.round(data.totals.bounceRate)}%`],
            ].map(([label, value], i) => (
              <div key={label} className={`bg-page px-4 py-4 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
                <dt className="label">{label}</dt>
                <dd className="tabular mt-1.5 text-[22px] font-light leading-[1.15] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-3">
            {[
              { title: "Top pages", rows: data.topPages, empty: "No page data yet." },
              { title: "Top sources", rows: data.topSources, empty: "No referrer data yet." },
              { title: "Top countries", rows: data.topCountries, empty: "No location data yet." },
            ].map((panel) => (
              <Section key={panel.title} title={panel.title} className="min-w-0">
                <Bars rows={panel.rows} empty={panel.empty} />
              </Section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
