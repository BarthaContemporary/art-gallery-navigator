import type { MetadataRoute } from "next";
import { sanityFetch, sitemapQuery, type SitemapEntry } from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION, absoluteUrl } from "@/lib/site";

type SitemapData = { events: SitemapEntry[]; publications: SitemapEntry[]; artists: SitemapEntry[] };

/** Newest edit in a list: the index page that lists them changed then too. */
const newest = (list: SitemapEntry[]) => list.map((e) => e.lastmod).sort().at(-1);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const d = await sanityFetch<SitemapData>({
    query: sitemapQuery,
    tags: ["exhibition", "publication", "artist", "work", "workList"],
    fallback: { events: [], publications: [], artists: [] },
  });
  const artists = ARTISTS_UNDER_CONSTRUCTION ? [] : d.artists;
  // changeFrequency and priority are left out: Google ignores both. Static
  // pages carry no lastmod rather than an invented one.
  return [
    { url: absoluteUrl("/"), lastModified: newest(d.events) },
    ...(ARTISTS_UNDER_CONSTRUCTION ? [] : [{ url: absoluteUrl("/artists"), lastModified: newest(artists) }]),
    { url: absoluteUrl("/publications"), lastModified: newest(d.publications) },
    ...["/about", "/faq", "/glossary", "/privacy", "/terms", "/cookies", "/aml", "/accessibility"].map((p) => ({ url: absoluteUrl(p) })),
    ...d.events.map((e) => ({ url: absoluteUrl(`/events/${e.slug}`), lastModified: e.lastmod })),
    ...artists.map((e) => ({ url: absoluteUrl(`/artists/${e.slug}`), lastModified: e.lastmod })),
    ...d.publications.map((e) => ({ url: absoluteUrl(`/publications/${e.slug}`), lastModified: e.lastmod })),
  ];
}
