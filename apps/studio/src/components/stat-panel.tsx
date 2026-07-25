"use client";

import { useEffect, useState } from "react";
import { CountUp } from "@/components/count-up";

const PERIODS: [string, string][] = [
  ["month", "Month"],
  ["quarter", "Quarter"],
  ["year", "Year"],
];

/** Dashboard KPI card with a month/quarter/year selector (fetches on change). */
export function StatPanel({ title, metric }: { title: string; metric: string }) {
  const [period, setPeriod] = useState("month");
  const [value, setValue] = useState<number | null>(null);
  const [format, setFormat] = useState<"count" | "gbp">("count");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dashboard/metric?metric=${metric}&period=${period}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { value: number; format: "count" | "gbp" }) => {
        if (!cancelled) {
          setValue(j.value);
          setFormat(j.format);
        }
      })
      .catch(() => {
        if (!cancelled) setValue(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [metric, period]);

  const fmt = (n: number) =>
    format === "gbp"
      ? new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: "GBP",
          maximumFractionDigits: 0,
        }).format(n)
      : n.toLocaleString("en-GB");

  return (
    <div className="rounded-[11px] border border-line bg-cell p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
          {title} · last
        </span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-md border border-line-control bg-control px-1.5 py-0.5 text-[11px] text-ink-mid"
          aria-label={`${title} period`}
        >
          {PERIODS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 font-mono text-[26px] text-ink-strong">
        {loading ? (
          <span
            className="jvb-shimmer inline-block h-[26px] w-20 rounded align-middle"
            aria-label="Loading"
          />
        ) : value == null ? (
          "—"
        ) : (
          <CountUp value={value} format={fmt} />
        )}
      </div>
    </div>
  );
}
