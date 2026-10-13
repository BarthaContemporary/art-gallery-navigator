"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";

type Point = { date: string; visitors: number; pageviews: number; enquiries: number };

// Trailing windows, as /api/dashboard/website counts them (30, 91, 365 days).
const PERIODS: [string, string][] = [
  ["month", "Last 30 days"],
  ["quarter", "Last 3 months"],
  ["year", "Last 12 months"],
];

/*
 * Series in the inks and the accent (spec C11), which follow the theme.
 * Visitors and pages viewed share the left scale; enquiries are a handful a
 * month against hundreds of visits, so they get a scale of their own (right)
 * rather than a flat line along the bottom. Pages viewed is dashed, so the
 * lines differ in more than colour.
 */
type Series = { key: keyof Point; label: string; color: string; dash?: string; scale: "left" | "right" };
const SERIES: Series[] = [
  { key: "visitors", label: "Visitors", color: "var(--jvb-ink)", scale: "left" },
  { key: "pageviews", label: "Pages viewed", color: "var(--jvb-meta)", dash: "5 4", scale: "left" },
  { key: "enquiries", label: "Enquiries", color: "var(--jvb-accent)", scale: "right" },
];

// Drawing units. The SVG stretches to the panel's width (preserveAspectRatio
// none) at a fixed height, and the strokes stay 1.5px (non-scaling-stroke),
// so the chart reads the same on a phone as on a desktop. The scale figures
// are HTML over the chart, where they keep their size too.
const W = 720;
const H = 180;
const PAD = { t: 6, b: 2 };

/** Website traffic: visitors + pages viewed + enquiries over time. */
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

  const { paths, maxLeft, maxRight } = useMemo(() => {
    const n = data.length;
    const maxLeft = Math.max(1, ...data.flatMap((d) => [d.visitors, d.pageviews]));
    const maxRight = Math.max(1, ...data.map((d) => d.enquiries));
    const innerH = H - PAD.t - PAD.b;
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const paths = SERIES.map((s) => {
      const max = s.scale === "left" ? maxLeft : maxRight;
      const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
      return {
        ...s,
        d: data
          .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[s.key] as number).toFixed(1)}`)
          .join(" "),
      };
    });
    return { paths, maxLeft, maxRight };
  }, [data]);

  const totals = SERIES.map((s) => ({
    ...s,
    total: data.reduce((sum, d) => sum + (d[s.key] as number), 0),
  }));

  return (
    <Section
      title="Website"
      actions={
        <Select
          fieldSize="sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Website period"
          className="w-auto"
        >
          {PERIODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      }
    >
      {/* The legend carries the totals, so the figures are there in words
          whatever the chart shows. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {totals.map((t) => (
          <li key={t.key} className="flex items-center gap-2 text-[13px]">
            <svg aria-hidden width="18" height="6" className="shrink-0">
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={t.color}
                strokeWidth="2"
                strokeDasharray={t.dash ? "4 3" : undefined}
              />
            </svg>
            <span className="text-body">
              {t.label}
              {t.scale === "right" ? <span className="text-meta"> (right scale)</span> : null}
            </span>
            {loading ? null : <span className="tabular font-medium text-ink">{formatCount(t.total)}</span>}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {loading ? (
          <Skeleton height={H} />
        ) : (
          <div className="relative">
            <div aria-hidden className="pointer-events-none flex justify-between text-[11px] leading-none text-meta">
              <span className="tabular">{formatCount(maxLeft)}</span>
              <span className="tabular">{formatCount(maxRight)}</span>
            </div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="mt-1 block w-full"
              style={{ height: H }}
              role="img"
              aria-label={`Website traffic: ${totals.map((t) => `${t.label.toLowerCase()} ${formatCount(t.total)}`).join(", ")}`}
            >
              {/* top of each scale and the baseline */}
              <line x1={0} y1={PAD.t} x2={W} y2={PAD.t} stroke="var(--jvb-rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1={0} y1={H - PAD.b} x2={W} y2={H - PAD.b} stroke="var(--jvb-rule-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {paths.map((p) => (
                <path
                  key={p.key}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="1.5"
                  strokeDasharray={p.dash}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
        )}
      </div>

      {!plausible ? (
        <p className="mt-2 text-[12px] leading-[1.4] text-meta">
          Visitors and pages viewed appear once Plausible analytics is connected. Enquiries come from
          the website&rsquo;s contact and booking forms.
        </p>
      ) : null}
    </Section>
  );
}
