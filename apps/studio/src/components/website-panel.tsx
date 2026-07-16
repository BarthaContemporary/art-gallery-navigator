"use client";

import { useEffect, useMemo, useState } from "react";

type Point = { date: string; visitors: number; pageviews: number; enquiries: number };

const PERIODS: [string, string][] = [
  ["month", "Month"],
  ["quarter", "Quarter"],
  ["year", "Year"],
];

const SERIES: { key: keyof Point; label: string; color: string }[] = [
  { key: "visitors", label: "Visitors", color: "#B5561E" },
  { key: "pageviews", label: "Pages viewed", color: "#3E6B8B" },
  { key: "enquiries", label: "Enquiries", color: "#4E7A51" },
];

const W = 720;
const H = 220;
const PAD = { l: 10, r: 10, t: 14, b: 22 };

/** Website traffic panel: visitors + pageviews + enquiries over time. */
export function WebsitePanel() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<Point[]>([]);
  const [plausible, setPlausible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dashboard/website?period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { series: Point[]; plausible: boolean }) => {
        if (!cancelled) {
          setData(j.series ?? []);
          setPlausible(j.plausible);
        }
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const { paths, max } = useMemo(() => {
    const n = data.length;
    const max = Math.max(
      1,
      ...data.flatMap((d) => [d.visitors, d.pageviews, d.enquiries]),
    );
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
    const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
    const paths = SERIES.map((s) => ({
      ...s,
      d: data
        .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[s.key] as number).toFixed(1)}`)
        .join(" "),
    }));
    return { paths, max };
  }, [data]);

  const totals = SERIES.map((s) => ({
    ...s,
    total: data.reduce((sum, d) => sum + (d[s.key] as number), 0),
  }));

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Website
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border border-line-control bg-control px-1.5 py-0.5 text-[11px] text-ink-mid"
          aria-label="Website period"
        >
          {PERIODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        {totals.map((t) => (
          <div key={t.key} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: t.color }}
            />
            <span className="text-[12px] text-ink-mid">{t.label}</span>
            <span className="font-mono text-[12px] text-ink-strong">
              {t.total.toLocaleString("en-GB")}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 overflow-hidden">
        {loading ? (
          <div className="flex h-[160px] items-center justify-center text-[12px] text-ink-soft">
            Loading…
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Website traffic">
            {/* baseline */}
            <line
              x1={PAD.l}
              y1={H - PAD.b}
              x2={W - PAD.r}
              y2={H - PAD.b}
              stroke="var(--jvb-border-soft)"
              strokeWidth="1"
            />
            {paths.map((p) => (
              <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth="1.8" strokeLinejoin="round" />
            ))}
            <text x={PAD.l} y={PAD.t - 2} className="fill-ink-faint" style={{ fontSize: 10 }}>
              {max.toLocaleString("en-GB")}
            </text>
          </svg>
        )}
      </div>

      {!plausible ? (
        <p className="mt-1 text-[11px] text-ink-soft">
          Visitor/pageview data appears once Plausible analytics is configured;
          enquiries are shown from the website contact/booking forms.
        </p>
      ) : null}
    </div>
  );
}
