/**
 * Read-only client for a self-hosted Plausible instance's Stats API (v2).
 * Lets the studio display the public website's visitor results without the
 * staff needing a Plausible login. Tracking itself lives on the public site;
 * the studio only *reads* aggregates here.
 *
 * Requires three server-side env vars (never NEXT_PUBLIC — the API key must
 * not reach the browser):
 *   PLAUSIBLE_STATS_HOST  e.g. https://analytics.joostvandenbergh.com
 *   PLAUSIBLE_API_KEY     a Stats API key created in Plausible settings
 *   PLAUSIBLE_SITE_ID     the public site's data-domain, e.g. joostvandenbergh.com
 */

export type PlausibleConfig = { host: string; apiKey: string; siteId: string };

export function plausibleConfig(): PlausibleConfig | null {
  const host = process.env.PLAUSIBLE_STATS_HOST?.trim().replace(/\/+$/, "");
  const apiKey = process.env.PLAUSIBLE_API_KEY;
  const siteId = process.env.PLAUSIBLE_SITE_ID?.trim();
  if (!host || !apiKey || !siteId) return null;
  return { host, apiKey, siteId };
}

type QueryBody = {
  metrics: string[];
  date_range: string;
  dimensions?: string[];
  order_by?: [string, "asc" | "desc"][];
  pagination?: { limit: number };
};

type QueryResult = { results: { metrics: number[]; dimensions: string[] }[] };

/*
 * The analytics page and the dashboard's website panel waited for these
 * queries on every view, with no time limit: a slow or stopped Plausible held
 * the page until the function timed out. Each query now gives up after
 * QUERY_TIMEOUT_MS, and answers are kept for CACHE_MS in the warm function.
 * They are site-wide visitor aggregates with nothing per user in them, so
 * sharing them between staff is safe; failures are not cached.
 */
const QUERY_TIMEOUT_MS = 5000;
const CACHE_MS = 5 * 60 * 1000;
const answers = new Map<string, { at: number; result: QueryResult }>();

async function query(cfg: PlausibleConfig, body: QueryBody): Promise<QueryResult | null> {
  const payload = JSON.stringify({ site_id: cfg.siteId, ...body });
  const key = `${cfg.host}|${payload}`;
  const cached = answers.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  try {
    const res = await fetch(`${cfg.host}/api/v2/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const result = (await res.json()) as QueryResult;
    if (answers.size > 200) answers.clear();
    answers.set(key, { at: Date.now(), result });
    return result;
  } catch {
    return null;
  }
}

export type TimeseriesPoint = { date: string; visitors: number; pageviews: number };

/** Per-day visitors + pageviews over the given range (e.g. "30d", "365d"). */
export async function fetchTimeseries(
  cfg: PlausibleConfig,
  dateRange: string,
): Promise<TimeseriesPoint[] | null> {
  const res = await query(cfg, {
    metrics: ["visitors", "pageviews"],
    date_range: dateRange,
    dimensions: ["time:day"],
    order_by: [["time:day", "asc"]],
  });
  if (!res) return null;
  return res.results.map((r) => ({
    date: r.dimensions[0] ?? "",
    visitors: r.metrics[0] ?? 0,
    pageviews: r.metrics[1] ?? 0,
  }));
}

export type AnalyticsOverview = {
  totals: { visitors: number; pageviews: number; visits: number; visitDuration: number; bounceRate: number };
  topPages: { name: string; visitors: number }[];
  topSources: { name: string; visitors: number }[];
  topCountries: { name: string; visitors: number }[];
} | null;

export async function fetchOverview(
  cfg: PlausibleConfig,
  dateRange: string,
): Promise<AnalyticsOverview> {
  const [agg, pages, sources, countries] = await Promise.all([
    query(cfg, {
      metrics: ["visitors", "pageviews", "visits", "visit_duration", "bounce_rate"],
      date_range: dateRange,
    }),
    query(cfg, {
      metrics: ["visitors"],
      date_range: dateRange,
      dimensions: ["event:page"],
      order_by: [["visitors", "desc"]],
      pagination: { limit: 8 },
    }),
    query(cfg, {
      metrics: ["visitors"],
      date_range: dateRange,
      dimensions: ["visit:source"],
      order_by: [["visitors", "desc"]],
      pagination: { limit: 8 },
    }),
    query(cfg, {
      metrics: ["visitors"],
      date_range: dateRange,
      dimensions: ["visit:country_name"],
      order_by: [["visitors", "desc"]],
      pagination: { limit: 8 },
    }),
  ]);

  if (!agg) return null;
  const m = agg.results[0]?.metrics ?? [0, 0, 0, 0, 0];
  const toList = (q: QueryResult | null) =>
    (q?.results ?? []).map((r) => ({
      name: r.dimensions[0] ?? "—",
      visitors: r.metrics[0] ?? 0,
    }));

  return {
    totals: {
      visitors: m[0] ?? 0,
      pageviews: m[1] ?? 0,
      visits: m[2] ?? 0,
      visitDuration: m[3] ?? 0,
      bounceRate: m[4] ?? 0,
    },
    topPages: toList(pages),
    topSources: toList(sources),
    topCountries: toList(countries),
  };
}
