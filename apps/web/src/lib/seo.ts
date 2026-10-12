/**
 * Page metadata (title, description, Open Graph, robots) for every route,
 * built in one place, plus the description fallbacks that the JSON-LD in
 * lib/structured-data.ts reuses, so a page's meta description and its
 * structured-data description are always the same sentence.
 *
 * Why every page goes through pageMeta(): Next merges metadata shallowly. A
 * page that returns `description: undefined` removes the layout's
 * description, and a page that returns its own `openGraph` drops the
 * layout's siteName and share image. pageMeta always returns a complete set.
 */
import type { Metadata } from "next";
import {
  imageDimensions,
  imageUrl,
  ratioUrl,
  type Artist,
  type Exhibition,
  type PortableBlock,
  type Publication,
  type SanityImage,
} from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName } from "@/lib/site";
import { eventDates } from "@/lib/events";
import { formatLifeDates } from "@/lib/life-dates";

/** Same suffix as the layout's title.template. */
const BRAND = ` — ${fallbackGalleryName}`;

export const HOME_TITLE = "Joost van den Bergh – Japanese and Indian Art, London";
export const HOME_DESCRIPTION =
  "London dealer in 20th-century Japanese art and Indian art: bronzes, metalwork, ceramics, bamboo and lacquer, shown at TEFAF Maastricht and Frieze Masters.";

export type OgImage = { url: string; width: number; height: number; alt: string };

/** public/og-default.jpg: the Site settings gallery photo cropped to 1200×630. */
export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "The Joost van den Bergh stand at TEFAF Maastricht, spring 2026",
};

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

/** Collapses tabs, newlines and double spaces left by the old-site import. */
export function oneLine(s: string | null | undefined): string | undefined {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t || undefined;
}

/**
 * Shortens text the owner wrote: at the last sentence end that leaves at
 * least 60% of the length, else at a word boundary with an ellipsis.
 * Undefined for empty text.
 */
export function clip(text: string | null | undefined, max = 155): string | undefined {
  const t = oneLine(text);
  if (!t) return undefined;
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  // A full stop, ! or ?, optionally closed by a bracket or quote, then a space.
  const ends = [...head.matchAll(/[.!?][)"'’”]?(?=\s)/g)].map((m) => (m.index ?? 0) + m[0].length);
  const sentence = ends.filter((i) => i >= max * 0.6).pop();
  if (sentence) return t.slice(0, sentence);
  let cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  if (sp > max * 0.6) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}

/**
 * The first of the candidate sentences that fits, longest and fullest
 * first; a sentence built from data is never cut mid-fact. Only when none
 * fits is the shortest one clipped.
 */
export function firstThatFits(candidates: (string | undefined)[], max = 155): string | undefined {
  const list = candidates.map(oneLine).filter((c): c is string => !!c);
  return list.find((c) => c.length <= max) ?? clip(list[list.length - 1], max);
}

/** Paragraph text of Portable Text blocks, on one line. */
export function blocksToText(blocks: PortableBlock[] | null | undefined): string | undefined {
  return oneLine(
    (blocks ?? [])
      .filter((b) => b._type === "block" && Array.isArray(b.children))
      .map((b) => (b.children as { text?: string }[]).map((c) => c.text ?? "").join(""))
      .join(" "),
  );
}

/** "Joost van den Bergh | Show" or "Show – Joost van den Bergh" → "Show"; the template adds the brand. */
export function stripBrand(title: string): string {
  return title
    .replace(/^\s*Joost van den Bergh\s*[|–—-]\s*/i, "")
    .replace(/\s*[|–—-]\s*Joost van den Bergh\s*$/i, "")
    .trim();
}

/**
 * The fullest version of a title that fits 60 characters: every version with
 * the brand suffix first, then every version without it, in the order given.
 * Only when none fits is the last one clipped.
 */
export function fitTitle(...versions: string[]): Metadata["title"] {
  const list = versions.map(oneLine).filter((v): v is string => !!v);
  const withBrand = list.find((v) => v.length + BRAND.length <= 60);
  if (withBrand) return withBrand;
  const bare = list.find((v) => v.length <= 60);
  if (bare) return { absolute: bare };
  const last = list[list.length - 1] ?? fallbackGalleryName;
  return { absolute: clip(last, 60) ?? last };
}

function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Descriptions (meta description and JSON-LD description)             */
/* ------------------------------------------------------------------ */

/** Event: Studio meta description, else the introduction, else a sentence from the data. */
export function eventDescription(ev: Exhibition): string | undefined {
  const name = oneLine(ev.title) ?? "Event";
  const dates = eventDates(ev.startDate, ev.endDate, ev.datePrecision);
  // With no subtitle, the catalogue's longer title carries the theme.
  const pub = oneLine(ev.relatedPublication?.title);
  const theme =
    oneLine(ev.subtitle) ??
    (pub && pub !== name && pub.startsWith(name) ? oneLine(pub.slice(name.length).replace(/^[\s–—:-]+/, "")) : undefined);
  // "Frieze Masters - The Regent's Park - Stand B03": the stand has its own field.
  const venue = oneLine(ev.venue?.replace(/\s*[-–·,]?\s*Stand\s+\S+\s*$/i, ""));
  const fair = ev.isArtFair ? oneLine(ev.fairName) ?? venue : undefined;
  const where = fair
    ? `${fallbackGalleryName} at ${fair}${ev.stand ? `, Stand ${ev.stand}` : ""}`
    : ev.isArtFair
      ? `Art fair presentation by ${fallbackGalleryName}`
      : venue && !/^gallery$/i.test(venue)
        ? `Exhibition by ${fallbackGalleryName} at ${venue}`
        : `Exhibition at ${fallbackGalleryName}, London`;
  const ids = new Set([...(ev.works ?? []), ...(ev.workLists ?? []).flatMap((l) => l?.works ?? [])].map((w) => w?._id).filter(Boolean));
  const workCount = ids.size + (ev.catalogue ?? []).filter((c) => c?.image).length;
  const at = `${where}${dates ? `, ${dates}` : ""}.`;
  const works = workCount ? ` ${workCount} works illustrated` : "";
  return (
    // Text the owner wrote for search is kept whole up to 170 characters.
    clip(ev.seo?.description, 170) ??
    clip(blocksToText(ev.intro)) ??
    // Built from the data: the theme goes first, then the catalogue mention,
    // then the works count, so whatever remains is whole.
    firstThatFits([
      theme ? `${name} – ${theme}. ${at}${works}${works && pub ? ", with the catalogue" : ""}${works ? "." : ""}` : undefined,
      `${name}. ${at}${works}${works && pub ? ", with the catalogue" : ""}${works ? "." : ""}`,
      `${name}. ${at}${works}${works ? "." : ""}`,
      `${name}. ${at}`,
    ])
  );
}

/** Publication: Studio meta description, else its description text, else a sentence from the data. */
export function publicationDescription(p: Publication): string | undefined {
  const name = oneLine(p.title) ?? "Publication";
  const facts = [p.publishedYear, p.pages ? `${p.pages} pages` : null].filter(Boolean).join(", ");
  const actions = [
    p.spreads?.length ? "read it in full online" : null,
    p.availability !== "outOfPrint" ? "order a printed copy" : null,
  ]
    .filter(Boolean)
    .join(" or ");
  // "Double Take – Works from, and inspired by, …": the part before the dash.
  const main = name.split(" – ")[0] ?? name;
  const kind = p.relatedExhibition ? "exhibition catalogue" : "catalogue";
  const published = `${kind} published by ${fallbackGalleryName}, London${facts ? `, ${facts}` : ""}.`;
  const offer = actions ? ` ${actions.charAt(0).toUpperCase()}${actions.slice(1)}.` : "";
  return (
    clip(p.seo?.description, 170) ??
    clip(blocksToText(p.description)) ??
    // The page title already carries the full name, so the subtitle goes
    // first, then the reading and ordering line.
    firstThatFits([
      `${name}: ${published}${offer}`,
      `${main}: ${published}${offer}`,
      `${main}: ${published}`,
      `${main}: ${kind} published by ${fallbackGalleryName}, London.`,
    ])
  );
}

/** First paragraph of the biography, if any. */
export function artistLead(a: Artist): string | undefined {
  return paragraphs(a.bioShort)[0] ?? paragraphs(a.bioLong)[0];
}

/** Artist: first biography paragraph, else works, dates and the latest show. */
export function artistDescription(a: Artist): string | undefined {
  const name = oneLine(a.name) ?? "Artist";
  const dates = formatLifeDates(a.lifeDates);
  const workCount = (a.works?.length ?? 0) + (a.catalogueWorks ?? []).reduce((n, ex) => n + (ex.entries?.length ?? 0), 0);
  const lastShow = oneLine((a.shownIn ?? []).find((e) => e?.title)?.title);
  const who = dates ? `${name} (${dates})` : name;
  const lead = workCount ? `${workCount} ${workCount === 1 ? "work" : "works"} by ${who}` : `Works by ${who}`;
  return (
    clip(artistLead(a)) ??
    firstThatFits([
      lastShow ? `${lead} at ${fallbackGalleryName}, London dealer in Japanese and Indian art, most recently in ${lastShow}.` : undefined,
      lastShow ? `${lead} at ${fallbackGalleryName}, London, most recently in ${lastShow}.` : undefined,
      `${lead} at ${fallbackGalleryName}, London dealer in Japanese and Indian art.`,
      `${lead} at ${fallbackGalleryName}, London.`,
    ])
  );
}

/** No biography, no works, no exhibition: the page is a name and a placeholder line. */
export function artistIsThin(a: Artist): boolean {
  return !artistLead(a) && !a.works?.length && !a.shownIn?.length;
}

/* ------------------------------------------------------------------ */
/* Images and the metadata object                                      */
/* ------------------------------------------------------------------ */

/** 'card' crops to 1200×630 on the hotspot; 'whole' keeps the picture uncropped (book covers, spreads). */
export function ogImage(image: SanityImage | null | undefined, alt: string, mode: "card" | "whole" = "card"): OgImage | null {
  const dims = imageDimensions(image);
  if (!dims) return null;
  if (mode === "card") {
    const url = ratioUrl(image, 1200 / 630, 1200);
    return url ? { url, width: 1200, height: 630, alt } : null;
  }
  const width = Math.min(1200, dims.width);
  const url = imageUrl(image, { width });
  return url ? { url, width, height: Math.round((width * dims.height) / dims.width), alt } : null;
}

export function pageMeta(o: {
  title: Metadata["title"];
  ogTitle: string;
  description?: string;
  path: string;
  type?: "website" | "article" | "profile" | "book";
  image?: OgImage | null;
  robots?: Metadata["robots"];
}): Metadata {
  const url = absoluteUrl(o.path);
  return {
    title: o.title,
    // Never `description: undefined`: that key would erase the layout default.
    ...(o.description ? { description: o.description } : {}),
    ...(o.robots ? { robots: o.robots } : {}),
    alternates: { canonical: url },
    openGraph: {
      title: o.ogTitle,
      ...(o.description ? { description: o.description } : {}),
      url,
      siteName: fallbackGalleryName,
      locale: "en_GB",
      type: o.type ?? "website",
      images: [o.image ?? DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image" },
  };
}
