"use client";

import { useEffect, useState } from "react";

type Slice = { label: string; count: number };

const FILTERS: [string, string][] = [
  ["all", "Everyone"],
  ["collector", "Collectors"],
  ["museum", "Museums"],
  ["press", "Press"],
];

// Muted greyscale wedges with the house orange as the lead accent.
const COLORS = [
  "#c65d2e",
  "#3f3f3f",
  "#6b6b6b",
  "#8f8f8f",
  "#a9a9a9",
  "#5a5a5a",
  "#bcae9e",
  "#7d7161",
  "#cfcfcf",
];

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = (angle - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  // Full circle can't be drawn as a single arc — caller handles the 1-slice case.
  const [sx, sy] = polar(cx, cy, r, end);
  const [ex, ey] = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey} Z`;
}

export function NationalityPie() {
  const [type, setType] = useState("all");
  const [slices, setSlices] = useState<Slice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dashboard/nationality?type=${type}`)
      .then((r) => r.json())
      .then((d: { slices?: Slice[]; total?: number }) => {
        if (cancelled) return;
        setSlices(d.slices ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setSlices([]);
          setTotal(0);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type]);

  const cx = 80;
  const cy = 80;
  const r = 78;
  let acc = 0;

  return (
    <section className="rounded-[11px] border border-line bg-cell p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-ink-strong">Contacts by nationality</h2>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12px] text-ink-mid"
          aria-label="Filter by contact type"
        >
          {FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-[12.5px] text-ink-soft">Loading…</p>
      ) : total === 0 ? (
        <p className="mt-6 text-[12.5px] text-ink-soft">
          No contacts with a recorded country for this filter.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Nationality breakdown">
            {slices.length === 1 ? (
              <circle cx={cx} cy={cy} r={r} fill={COLORS[0]} />
            ) : (
              slices.map((s, i) => {
                const start = (acc / total) * 360;
                acc += s.count;
                const end = (acc / total) * 360;
                return (
                  <path
                    key={s.label}
                    d={arcPath(cx, cy, r, start, end)}
                    fill={COLORS[i % COLORS.length]}
                  />
                );
              })
            )}
          </svg>

          <ul className="min-w-[160px] flex-1 space-y-1.5">
            {slices.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
                <span
                  aria-hidden
                  className="inline-block h-[10px] w-[10px] rounded-[3px]"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-body">{s.label}</span>
                <span className="font-mono text-[11.5px] text-ink-muted">
                  {s.count} · {Math.round((s.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
