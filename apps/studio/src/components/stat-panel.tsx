"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/field";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, gbpDisplay } from "@/lib/format";

// Trailing windows, as /api/dashboard/metric counts them (30, 91, 365 days).
const PERIODS: [string, string][] = [
  ["month", "Last 30 days"],
  ["quarter", "Last 3 months"],
  ["year", "Last 12 months"],
];

/** Dashboard KPI with a period selector (fetches on change). */
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

  // Dashboard figures: whole pounds, grouped counts.
  const fmt = (n: number) => (format === "gbp" ? gbpDisplay(n) : formatCount(n));

  return (
    <Section
      title={title}
      actions={
        <Select
          fieldSize="sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label={`${title} period`}
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
      <div className="tabular text-[26px] font-light leading-[1.15] text-ink" aria-live="polite">
        {loading ? (
          <Skeleton width={96} height={30} />
        ) : value == null ? (
          // No figure (the request failed): the empty mark, with words for
          // a screen reader.
          <span title="Not available">
            —<span className="sr-only">Not available</span>
          </span>
        ) : (
          fmt(value)
        )}
      </div>
    </Section>
  );
}
