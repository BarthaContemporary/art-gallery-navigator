import { plausibleConfig, fetchOverview } from "@/lib/plausible";

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
    return <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((r) => (
        <li key={r.name} className="relative px-4 py-2">
          <div
            className="absolute inset-y-0 left-0 bg-oranje/10"
            style={{ width: `${(r.visitors / max) * 100}%` }}
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="truncate text-[13px] text-ink-body">{r.name}</span>
            <span className="shrink-0 font-mono text-[12px] text-ink-muted">
              {r.visitors.toLocaleString("en-GB")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

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
      <div className="max-w-[640px]">
        <p className="text-[13px] leading-relaxed text-ink-body">
          Website analytics are not connected yet. Once the self-hosted
          Plausible instance is running, set{" "}
          <code className="font-mono text-[12px] text-ink-strong">PLAUSIBLE_STATS_HOST</code>,{" "}
          <code className="font-mono text-[12px] text-ink-strong">PLAUSIBLE_API_KEY</code> and{" "}
          <code className="font-mono text-[12px] text-ink-strong">PLAUSIBLE_SITE_ID</code>{" "}
          in the studio&rsquo;s environment and the public site&rsquo;s visitor
          results will appear here.
        </p>
        <p className="mt-3 text-[12.5px] text-ink-muted">
          Analytics run on the public website only — the studio is never tracked.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          Public website · {process.env.PLAUSIBLE_SITE_ID}
        </p>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <a
              key={r.key}
              href={`/analytics?range=${r.key}`}
              className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                r.key === range
                  ? "border-oranje/40 bg-oranje/10 text-oranje"
                  : "border-line-control bg-control text-ink-mid hover:text-ink-strong"
              }`}
            >
              {r.label}
            </a>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="mt-4 rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] text-ink-body">
          Couldn&rsquo;t reach Plausible. Check the host, API key and site ID, and
          that the instance is running.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ["Unique visitors", data.totals.visitors.toLocaleString("en-GB")],
              ["Total visits", data.totals.visits.toLocaleString("en-GB")],
              ["Pageviews", data.totals.pageviews.toLocaleString("en-GB")],
              ["Avg. visit", fmtDuration(data.totals.visitDuration)],
              ["Bounce rate", `${Math.round(data.totals.bounceRate)}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[11px] border border-line bg-cell p-4">
                <dt className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  {label}
                </dt>
                <dd className="mt-1 font-mono text-[20px] text-ink-strong">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { title: "Top pages", rows: data.topPages, empty: "No page data yet." },
              { title: "Top sources", rows: data.topSources, empty: "No referrer data yet." },
              { title: "Top countries", rows: data.topCountries, empty: "No location data yet." },
            ].map((panel) => (
              <div key={panel.title} className="overflow-hidden rounded-[11px] border border-line bg-cell">
                <p className="border-b border-line px-4 py-2.5 text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  {panel.title}
                </p>
                <Bars rows={panel.rows} empty={panel.empty} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
