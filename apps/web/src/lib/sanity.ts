import { createClient } from "next-sanity";
import groq from "groq";

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "placeholder";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
export const apiVersion = "2026-07-01";

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
  perspective: "published",
});

/**
 * Cached, tag-revalidated fetch. Every query is tagged with "sanity" plus
 * its document-type tags so `/api/revalidate` can invalidate precisely.
 * Falls back gracefully (empty state instead of a 500/build failure) when
 * Sanity is unreachable or not yet configured.
 */
export async function sanityFetch<T>({
  query,
  params = {},
  tags = [],
  fallback,
}: {
  query: string;
  params?: Record<string, unknown>;
  tags?: string[];
  fallback: T;
}): Promise<T> {
  try {
    return await sanityClient.fetch<T>(query, params, {
      next: { revalidate: 3600, tags: ["sanity", ...tags] },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sanity] fetch failed, using fallback:", error);
    }
    return fallback;
  }
}

/* ------------------------------------------------------------------ */
/* Image URLs (dependency-free — parses the asset _ref)                */
/* ------------------------------------------------------------------ */

export interface SanityImage {
  _key?: string;
  asset?: { _ref?: string; _type?: string } | null;
  caption?: string | null;
  role?: string | null;
  alt?: string | null;
}

/** Parse `image-{id}-{w}x{h}-{format}` asset refs into a CDN URL. */
export function imageUrl(
  image: SanityImage | null | undefined,
  opts: { width?: number; height?: number; quality?: number } = {},
): string | null {
  const ref = image?.asset?._ref;
  if (!ref) return null;
  const parts = ref.split("-");
  if (parts.length !== 4 || parts[0] !== "image") return null;
  const [, id, dims, format] = parts;
  const search = new URLSearchParams({ auto: "format" });
  if (opts.width) search.set("w", String(opts.width));
  if (opts.height) search.set("h", String(opts.height));
  search.set("q", String(opts.quality ?? 80));
  search.set("fit", "max");
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${dims}.${format}?${search.toString()}`;
}

/** Intrinsic dimensions encoded in the asset _ref, for next/image. */
export function imageDimensions(
  image: SanityImage | null | undefined,
): { width: number; height: number } | null {
  const ref = image?.asset?._ref;
  if (!ref) return null;
  const match = /-(\d+)x(\d+)-/.exec(ref);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */

/** Loosely-typed Portable Text block (rendered by components/portable-text). */
export interface PortableBlock {
  _type: string;
  _key: string;
  [key: string]: unknown;
}

export interface Work {
  _id: string;
  slug: string | null;
  stockNumber: string | null;
  title: string | null;
  maker: string | null;
  makerLifeDates: string | null;
  period: string | null;
  originRegion: string | null;
  medium: string | null;
  dimensionsDisplay: string | null;
  description: string | null;
  priceDisplay: string | null;
  available: boolean | null;
  supabaseId: string | null;
  category: string | null;
  categorySlug: string | null;
  images: SanityImage[] | null;
}

export interface WorkListResult {
  items: Work[];
  total: number;
  categories: { category: string | null; categorySlug: string | null }[];
}

export interface Collection {
  _id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover: SanityImage | null;
  workCount: number | null;
  works?: Work[] | null;
}

export interface Exhibition {
  _id: string;
  title: string | null;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  body: PortableBlock[] | null;
  works: Work[] | null;
}

export interface JournalPost {
  _id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  cover: SanityImage | null;
  body?: PortableBlock[] | null;
}

export interface SitePage {
  _id: string;
  title: string | null;
  slug: string | null;
  body: PortableBlock[] | null;
}

export interface SiteSettings {
  galleryName: string | null;
  tagline: string | null;
  aboutTeaser: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  openingHours: string | null;
  socials: { _key: string; label: string | null; url: string | null }[] | null;
  defaultSeo: {
    title: string | null;
    description: string | null;
    ogImage: SanityImage | null;
  } | null;
  featuredWorks: Work[] | null;
}

/* ------------------------------------------------------------------ */
/* GROQ queries                                                        */
/* ------------------------------------------------------------------ */

const workFields = /* groq */ `{
  _id,
  "slug": slug.current,
  stockNumber,
  title,
  maker,
  makerLifeDates,
  period,
  originRegion,
  medium,
  dimensionsDisplay,
  description,
  priceDisplay,
  available,
  supabaseId,
  category,
  categorySlug,
  images[]{ _key, asset, caption, role }
}`;

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0]{
  galleryName,
  tagline,
  aboutTeaser,
  address,
  email,
  phone,
  openingHours,
  socials[]{ _key, label, url },
  defaultSeo{ title, description, ogImage{ asset } },
  featuredWorks[]->${workFields}
}`;

/**
 * Paginated works list, filterable by category slug.
 * Pass $category = "" for "all".
 */
export const worksQuery = groq`{
  "items": *[
    _type == "work" &&
    defined(slug.current) &&
    ($category == "" || categorySlug == $category)
  ] | order(_createdAt desc) [$offset...$end] ${workFields},
  "total": count(*[
    _type == "work" &&
    defined(slug.current) &&
    ($category == "" || categorySlug == $category)
  ]),
  "categories": *[_type == "work" && defined(categorySlug)]{ category, categorySlug }
}`;

export const workBySlugQuery = groq`*[_type == "work" && slug.current == $slug][0]${workFields}`;

export const workSlugsQuery = groq`*[_type == "work" && defined(slug.current)].slug.current`;

export const collectionsQuery = groq`*[_type == "collection" && defined(slug.current)] | order(title asc){
  _id,
  title,
  "slug": slug.current,
  description,
  cover{ asset, caption },
  "workCount": count(works)
}`;

export const collectionBySlugQuery = groq`*[_type == "collection" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  description,
  cover{ asset, caption },
  works[]->${workFields}
}`;

export const collectionSlugsQuery = groq`*[_type == "collection" && defined(slug.current)].slug.current`;

export const exhibitionsQuery = groq`*[_type == "exhibition"] | order(coalesce(startDate, "0000") desc){
  _id,
  title,
  venue,
  startDate,
  endDate,
  body,
  works[]->${workFields}
}`;

export const journalPostsQuery = groq`*[_type == "journalPost" && defined(slug.current)] | order(coalesce(publishedAt, _createdAt) desc){
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  cover{ asset, caption }
}`;

export const journalPostBySlugQuery = groq`*[_type == "journalPost" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  publishedAt,
  cover{ asset, caption },
  body
}`;

export const journalSlugsQuery = groq`*[_type == "journalPost" && defined(slug.current)].slug.current`;

export const pageBySlugQuery = groq`*[_type == "page" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  body
}`;

/* ------------------------------------------------------------------ */
/* Convenience loaders                                                 */
/* ------------------------------------------------------------------ */

export function getSiteSettings(): Promise<SiteSettings | null> {
  return sanityFetch<SiteSettings | null>({
    query: siteSettingsQuery,
    tags: ["siteSettings", "work"],
    fallback: null,
  });
}
