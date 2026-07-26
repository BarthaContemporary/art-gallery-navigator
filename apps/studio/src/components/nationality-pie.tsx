"use client";

import { useEffect, useMemo, useState } from "react";

type Slice = { label: string; count: number };

const FILTERS: [string, string][] = [
  ["all", "Everyone"],
  ["collector", "Collectors"],
  ["museum", "Museums"],
  ["press", "Press"],
];

// Validated categorical palette (colorblind-safe adjacent pairs in this fixed
// order — checked with the dataviz validator). The last slot is a neutral grey
// reserved for the rolled-up "Other" bucket, which is never a real category.
const COLORS = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
  "#9b9a92", // neutral — "Other"
];
// Gap colour between wedges — must track the card it sits on, so it follows
// the theme (it was hardcoded light, which drew near-white gaps in dark mode).
const SURFACE = "var(--jvb-bg-cell)";

// Separator weight. Deliberately hairline: the stroke is centred on the wedge
// outline, so it eats HALF ITS WIDTH from each neighbour. At the old 2px a
// long-tail slice of ~2% (≈9° — about 6px across at its base) lost most of
// itself to white on both sides and read far smaller than its real share.
// 0.75px still separates adjacent colours without distorting the data.
const SEPARATOR = 0.75;

// How far a hovered wedge eases out along its bisector, in viewBox units.
const NUDGE = 7;
// Entrance sweep duration — legend rows are timed against this so each row
// arrives exactly as its own wedge is drawn.
const SWEEP_MS = 820;

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

  // The wedge that's currently lit — set from either the slice or its legend
  // row, so the two halves of the chart point at each other.
  const [active, setActive] = useState<number | null>(null);

  // Resolve each slice's angles once: the arc path, the offset it eases out
  // along when hovered (its bisector), and the moment in the sweep when it is
  // drawn — which is also when its legend row should arrive.
  const wedges = useMemo(() => {
    let acc = 0;
    return slices.map((s, i) => {
      const start = (acc / total) * 360;
      acc += s.count;
      const end = (acc / total) * 360;
      const mid = ((start + end) / 2 - 90) * (Math.PI / 180);
      return {
        ...s,
        i,
        d: arcPath(cx, cy, r, start, end),
        color: COLORS[i % COLORS.length]!,
        dx: Math.cos(mid) * NUDGE,
        dy: Math.sin(mid) * NUDGE,
        // Fraction of the revolution already swept when this wedge begins.
        appearsAt: Math.round((start / 360) * SWEEP_MS),
      };
    });
  }, [slices, total]);

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
        <div className="mt-4 flex flex-wrap items-center gap-6" aria-label="Loading">
          <span className="jvb-shimmer block h-[160px] w-[160px] rounded-full" />
          <ul className="min-w-[160px] flex-1 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="jvb-shimmer h-[13px] rounded" style={{ width: `${88 - i * 12}%` }} />
            ))}
          </ul>
        </div>
      ) : total === 0 ? (
        <p className="mt-6 text-[12.5px] text-ink-soft">
          No contacts with a recorded country for this filter.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-6">
          {/* The mask on this wrapper is what sweeps — one clock-wipe over the
              whole chart, so the pie draws itself in data order. */}
          <div className="jvb-sweep h-[160px] w-[160px] shrink-0">
            <svg
              width="160"
              height="160"
              viewBox="0 0 160 160"
              role="img"
              aria-label="Nationality breakdown"
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") setActive(null);
              }}
            >
              {slices.length === 1 ? (
                <circle cx={cx} cy={cy} r={r} fill={COLORS[0]} />
              ) : (
                wedges.map((w) => (
                  <path
                    key={w.label}
                    d={w.d}
                    fill={w.color}
                    stroke={SURFACE}
                    strokeWidth={SEPARATOR}
                    strokeLinejoin="round"
                    className="jvb-slice"
                    style={{
                      transform:
                        active === w.i ? `translate(${w.dx}px, ${w.dy}px)` : undefined,
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setActive(w.i);
                    }}
                  />
                ))
              )}
            </svg>
          </div>

          <ul
            className="min-w-[160px] flex-1 space-y-1.5"
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setActive(null);
            }}
          >
            {wedges.map((w) => (
              <li
                key={w.label}
                // Each row rises in at the moment the sweep reaches its wedge,
                // so chart and legend read as one motion rather than two.
                style={{ "--jvb-stagger": `${w.appearsAt}ms` } as React.CSSProperties}
                className={`jvb-rise flex items-center gap-2 rounded-md px-1 py-0.5 text-[12.5px] transition-colors ${
                  active === w.i ? "bg-control" : ""
                }`}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setActive(w.i);
                }}
              >
                <span
                  aria-hidden
                  className="inline-block h-[10px] w-[10px] shrink-0 rounded-[3px]"
                  style={{ background: w.color }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-body">{w.label}</span>
                <span className="font-mono text-[11.5px] text-ink-muted">
                  {w.count} · {Math.round((w.count / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
