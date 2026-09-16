import groq from "groq";
import { sanityFetch, type SanityImage } from "@/lib/sanity";

/**
 * Search works over a compact, cached index rather than per-keystroke GROQ:
 * the whole site is a few hundred records, so one fetch (revalidated by the
 * Sanity webhook like every other query) lets us match romaji AND kanji as
 * plain substrings — GROQ's tokeniser is unreliable for CJK.
 */

export type SearchHit = {
  kind: "artist" | "event" | "work" | "publication";
  id: string;
  /** Primary text shown, e.g. "HARA Satoshi 原智" or "Title | Code — HARA Satoshi". */
  text: string;
  /** Secondary grey text: dates, status. */
  meta: string | null;
  href: string;
  image: SanityImage | null;
  /** Aspect ratio of the thumbnail (1, 3/4, 4/5, 16/9). */
  ratio: number;
  /** Everything matchable, lower-cased. */
  haystack: string;
};

type IndexDoc = {
  artists: {
    _id: string; name: string | null; nameNative: string | null; lifeDates: string | null;
    country: string | null; period: string | null; slug: string | null; portrait: SanityImage | null;
  }[];
  events: {
    _id: string; title: string | null; slug: string | null; venue: string | null; fairName: string | null;
    startDate: string | null; endDate: string | null; coverImage: SanityImage | null;
    catalogue: { _key: string; title: string | null; maker: string | null; makerDates: string | null; reference: string | null; medium: string | null; sold: boolean | null; image: SanityImage | null }[] | null;
  }[];
  works: {
    _id: string; title: string | null; maker: string | null; makerNative: string | null; stockNumber: string | null;
    medium: string | null; available: boolean | null; slug: string | null; image: SanityImage | null; eventSlug: string | null;
    artistSlug: string | null;
  }[];
  publications: {
    _id: string; title: string | null; slug: string | null; publishedYear: number | null; availability: string | null; coverImage: SanityImage | null;
  }[];
};

const indexQuery = groq`{
  "artists": *[_type == "artist" && !coalesce(hidden, false)] | order(name asc){
    _id, name, nameNative, lifeDates, country, period, "slug": slug.current, portrait{ asset, hotspot }
  },
  "events": *[_type == "exhibition" && defined(slug.current) && !coalesce(hidden, false)]
    | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc){
    _id, title, "slug": slug.current, venue, fairName, startDate, endDate,
    coverImage{ asset, hotspot },
    catalogue[]{ _key, title, maker, makerDates, reference, medium, sold, image{ asset, hotspot } }
  },
  "works": *[_type == "work" && defined(slug.current)] | order(_createdAt desc){
    _id, title, maker, makerNative, stockNumber, medium, available, "slug": slug.current,
    "image": images[0]{ asset, hotspot },
    "eventSlug": *[_type == "exhibition" && !coalesce(hidden, false) && references(^._id)][0].slug.current,
    "artistSlug": artist->slug.current
  },
  "publications": *[_type == "publication" && defined(slug.current) && !coalesce(hidden, false)]
    | order(coalesce(publishedYear, 0) desc){
    _id, title, "slug": slug.current, publishedYear, availability, coverImage{ asset, hotspot }
  }
}`;

function yearOf(d: string | null): string | null {
  const y = d ? new Date(d).getFullYear() : NaN;
  return Number.isNaN(y) ? null : String(y);
}

export async function loadSearchIndex(): Promise<SearchHit[]> {
  const doc = await sanityFetch<IndexDoc | null>({
    query: indexQuery,
    tags: ["artist", "exhibition", "work", "publication"],
    fallback: null,
  });
  if (!doc) return [];
  const hits: SearchHit[] = [];
  const lc = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" ").toLowerCase();

  for (const a of doc.artists) {
    if (!a.slug) continue;
    hits.push({
      kind: "artist",
      id: a._id,
      text: [a.name, a.nameNative].filter(Boolean).join(" "),
      meta: a.lifeDates,
      href: `/artists/${a.slug}`,
      image: a.portrait,
      ratio: 1,
      haystack: lc(a.name, a.nameNative, a.lifeDates, a.country, a.period),
    });
  }
  for (const e of doc.events) {
    if (!e.slug) continue;
    const year = yearOf(e.endDate) ?? yearOf(e.startDate);
    hits.push({
      kind: "event",
      id: e._id,
      text: e.title ?? "Untitled",
      meta: [e.fairName ?? e.venue, year].filter(Boolean).join(" · ") || null,
      href: `/events/${e.slug}`,
      image: e.coverImage,
      ratio: 16 / 9,
      haystack: lc(e.title, e.venue, e.fairName, year),
    });
    for (const c of e.catalogue ?? []) {
      const who = c.maker ? (c.makerDates ? `${c.maker} (${c.makerDates})` : c.maker) : null;
      hits.push({
        kind: "work",
        id: `${e._id}:${c._key}`,
        text: [c.title ?? c.reference ?? "Work", who].filter(Boolean).join(" — "),
        meta: [e.title, c.sold ? "Sold" : null].filter(Boolean).join(" · ") || null,
        href: `/events/${e.slug}?work=${encodeURIComponent(c._key)}`,
        image: c.image,
        ratio: 1,
        haystack: lc(c.title, c.maker, c.reference, c.medium, e.title),
      });
    }
  }
  for (const w of doc.works) {
    if (!w.slug) continue;
    // A work is reached through its event or its artist page; with neither
    // there is nowhere to send the reader, so it stays out of the results.
    const href = w.eventSlug
      ? `/events/${w.eventSlug}?work=${encodeURIComponent(w.slug)}`
      : w.artistSlug
        ? `/artists/${w.artistSlug}?work=${encodeURIComponent(w.slug)}`
        : null;
    if (!href) continue;
    const title = [w.title ?? "Untitled", w.stockNumber].filter(Boolean).join(" | ");
    const who = [w.maker, w.makerNative].filter(Boolean).join(" ");
    hits.push({
      kind: "work",
      id: w._id,
      text: who ? `${title} — ${who}` : title,
      meta: w.available === false ? "Sold" : w.available ? "Available" : null,
      href,
      image: w.image,
      ratio: 1,
      haystack: lc(w.title, w.maker, w.makerNative, w.stockNumber, w.medium),
    });
  }
  for (const p of doc.publications) {
    if (!p.slug) continue;
    hits.push({
      kind: "publication",
      id: p._id,
      text: p.title ?? "Untitled",
      meta: [p.publishedYear ? String(p.publishedYear) : null, p.availability === "outOfPrint" ? "out of print" : "available"]
        .filter(Boolean)
        .join(" · "),
      href: `/publications/${p.slug}`,
      image: p.coverImage,
      ratio: 4 / 5,
      haystack: lc(p.title, p.publishedYear ? String(p.publishedYear) : null),
    });
  }
  return hits;
}

/** Every whitespace-separated term must appear somewhere in the haystack. */
export function searchHits(index: SearchHit[], query: string): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return index.filter((h) => terms.every((t) => h.haystack.includes(t)));
}
