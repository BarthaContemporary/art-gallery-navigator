"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RatioImage } from "./ratio-image";
import { RATIO, type Artist } from "@/lib/sanity";

type Mode = "az" | "country" | "period";
const MODES: { key: Mode; label: string }[] = [
  { key: "az", label: "A–Z" },
  { key: "country", label: "Country" },
  { key: "period", label: "Period" },
];

/**
 * Artists index (handoff 2c): 1:1 portraits, romaji in 500 with the kanji
 * grey beside it, life dates below. The quiet text filter on the right
 * regroups the grid — A–Z, by country, by period — with no dropdown chrome.
 */
export function ArtistsGrid({ artists }: { artists: Artist[] }) {
  const [mode, setMode] = useState<Mode>("az");

  const groups = useMemo(() => {
    if (mode === "az") return [{ key: "all", label: null as string | null, items: artists }];
    const field = mode === "country" ? "country" : "period";
    const map = new Map<string, Artist[]>();
    for (const a of artists) {
      const k = (a[field] ?? "").trim() || "Other";
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
      .map(([label, items]) => ({ key: label, label, items }));
  }, [artists, mode]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="t-title">Artists</h1>
        <ul className="flex gap-x-4 font-sans text-ui" aria-label="Order artists by">
          {MODES.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => setMode(m.key)}
                aria-pressed={mode === m.key}
                className={`min-h-[44px] ${mode === m.key ? "text-ink" : "text-meta hover:text-ink"}`}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {artists.length === 0 ? (
        <p className="mt-8 font-sans text-body text-meta">Artists will appear here.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-8">
            {g.label ? <h2 className="label mb-4">{g.label}</h2> : null}
            <ul className="tiles-6">
              {g.items.map((a) => (
                <li key={a._id}>
                  <Link href={`/artists/${a.slug}`} className="group block">
                    <RatioImage
                      image={a.portrait}
                      ratio={RATIO.portrait}
                      width={700}
                      alt={a.name ?? "Artist"}
                      sizes="(min-width: 640px) 17vw, 33vw"
                    />
                    <p className="mt-2 font-sans text-small font-medium leading-snug text-ink group-hover:text-accent">
                      {a.name}
                      {a.nameNative ? <span className="ml-2 font-normal text-light">{a.nameNative}</span> : null}
                    </p>
                    {a.lifeDates ? <p className="mt-0.5 font-sans text-[12px] text-meta">{a.lifeDates}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
