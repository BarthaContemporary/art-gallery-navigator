"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArtistPortrait, initialOf } from "./artist-portrait";
import type { Artist } from "@/lib/sanity";
import { formatLifeDates } from "@/lib/life-dates";
import { scriptLang } from "@/lib/script-lang";
import { ARTISTS_UNDER_CONSTRUCTION } from "@/lib/site";

type Mode = "az" | "country" | "period";
const MODES: { key: Mode; label: string }[] = [
  { key: "az", label: "A to Z" },
  { key: "country", label: "Country" },
  { key: "period", label: "Period" },
];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Artists index: black-and-white squares (portrait, a detail of a work, or
 * the initial on the field), six to a row, under the name with the kanji
 * grey beside it and the life dates below. The quiet text filter on the
 * right regroups the grid by letter, country or period; in the A to Z a
 * letter row jumps down the page.
 */
export function ArtistsGrid({ artists }: { artists: Artist[] }) {
  const [mode, setMode] = useState<Mode>("az");

  const groups = useMemo(() => {
    const map = new Map<string, Artist[]>();
    if (mode === "az") {
      // Artists arrive A to Z, so insertion order is the letter order.
      for (const a of artists) {
        const k = initialOf(a.name) || "Other";
        map.set(k, [...(map.get(k) ?? []), a]);
      }
      return [...map.entries()].map(([label, items]) => ({ key: `letter-${label}`, label, items }));
    }
    const field = mode === "country" ? "country" : "period";
    for (const a of artists) {
      const k = (a[field] ?? "").trim() || "Other";
      map.set(k, [...(map.get(k) ?? []), a]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b)))
      .map(([label, items]) => ({ key: `${field}-${label}`, label, items }));
  }, [artists, mode]);

  const lettersPresent = useMemo(() => new Set(mode === "az" ? groups.map((g) => g.label) : []), [groups, mode]);

  return (
    <div>
      <header className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-2">
        <h1 className="t-title">Artists</h1>
        <ul className="flex gap-x-5 font-sans text-ui" aria-label="Order artists by">
          {MODES.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => setMode(m.key)}
                aria-pressed={mode === m.key}
                className={`-my-3 py-3 transition-colors duration-150 ${mode === m.key ? "text-ink" : "text-meta hover:text-ink"}`}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      </header>
      <p className="mt-2 font-sans text-small text-meta">
        <span className="tabular">{artists.length}</span> artists and makers
      </p>

      {mode === "az" && artists.length > 0 ? (
        <nav aria-label="Jump to a letter" className="-mb-2 mt-6 grid grid-cols-13 font-sans text-ui sm:flex sm:flex-wrap">
          {LETTERS.map((l) =>
            lettersPresent.has(l) ? (
              <a
                key={l}
                href={`#letter-${l}`}
                className="inline-flex min-h-[44px] items-center justify-center text-ink no-underline transition-colors duration-150 hover:text-accent sm:min-w-[32px]"
              >
                {l}
              </a>
            ) : (
              <span key={l} aria-hidden className="inline-flex min-h-[44px] items-center justify-center text-light/60 sm:min-w-[32px]">
                {l}
              </span>
            ),
          )}
        </nav>
      ) : null}

      {artists.length === 0 ? (
        <p className="mt-8 font-sans text-body text-meta">Artists will appear here.</p>
      ) : (
        groups.map((g, gi) => (
          <section key={g.key} id={g.key} className="mt-12 scroll-mt-24 md:mt-14">
            <h2 className="label mb-5 text-meta">{g.label}</h2>
            <ul className="tiles-6">
              {g.items.map((a, i) => (
                <li key={a._id}>
                  <Tile href={ARTISTS_UNDER_CONSTRUCTION ? null : `/artists/${a.slug}`}>
                    <ArtistPortrait
                      subject={a}
                      width={600}
                      sizes="(min-width: 640px) 16vw, 33vw"
                      priority={gi === 0 && i < 6}
                      decorative
                    />
                    <p className="mt-3 font-sans text-small font-medium leading-snug text-ink transition-colors duration-150 group-hover:text-accent">
                      {a.name}
                      {a.nameNative ? (
                        <span lang={scriptLang(a.nameNative)} className="ml-2 font-normal text-light">
                          {a.nameNative}
                        </span>
                      ) : null}
                    </p>
                    {a.lifeDates ? <p className="tabular mt-1 font-sans text-[12px] text-meta">{formatLifeDates(a.lifeDates)}</p> : null}
                  </Tile>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/** A tile is a link to the artist page, or, while the pages are rebuilt, a plain block. */
function Tile({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className="group block">
      {children}
    </Link>
  ) : (
    <div className="block">{children}</div>
  );
}
