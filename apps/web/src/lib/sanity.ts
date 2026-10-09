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
  hotspot?: { x?: number; y?: number; width?: number; height?: number } | null;
  /** Studio crop as fractions trimmed from each edge. */
  crop?: { top?: number; bottom?: number; left?: number; right?: number } | null;
}

/** Parse `image-{id}-{w}x{h}-{format}` asset refs into a CDN URL. */
export function imageUrl(
  image: SanityImage | null | undefined,
  opts: {
    width?: number;
    height?: number;
    quality?: number;
    fit?: "max" | "crop";
    /** -100 renders the image in black and white on the CDN. */
    saturation?: number;
    /** Keep only this part of the image (fractions trimmed from each edge) before fitting; overrides the Studio crop. */
    crop?: { top?: number; bottom?: number; left?: number; right?: number } | null;
  } = {},
): string | null {
  const ref = image?.asset?._ref;
  if (!ref) return null;
  const parts = ref.split("-");
  if (parts.length !== 4 || parts[0] !== "image") return null;
  const [, id, dims, format] = parts;
  const search = new URLSearchParams({ auto: "format" });
  const rect = cropRect(dims ?? "", opts.crop === undefined ? image?.crop : opts.crop);
  if (rect) search.set("rect", rect);
  if (opts.width) search.set("w", String(opts.width));
  if (opts.height) search.set("h", String(opts.height));
  search.set("q", String(opts.quality ?? 80));
  if (typeof opts.saturation === "number") search.set("sat", String(opts.saturation));
  if (opts.fit === "crop") {
    // Fixed-ratio crop honouring the Studio hotspot when one is set. The
    // focal point is given relative to the whole image; the CDN reads it
    // relative to `rect`, so it is re-based when a crop applies.
    search.set("fit", "crop");
    const hs = image?.hotspot;
    if (hs && typeof hs.x === "number" && typeof hs.y === "number") {
      const within = rect ? rectFractions(rect, dims ?? "") : null;
      const fx = within ? (hs.x - within.left) / within.width : hs.x;
      const fy = within ? (hs.y - within.top) / within.height : hs.y;
      search.set("crop", "focalpoint");
      search.set("fp-x", Math.min(1, Math.max(0, fx)).toFixed(3));
      search.set("fp-y", Math.min(1, Math.max(0, fy)).toFixed(3));
    } else {
      search.set("crop", "center");
    }
  } else {
    search.set("fit", "max");
  }
  return `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${dims}.${format}?${search.toString()}`;
}

/**
 * The CDN's `rect` (left, top, width, height in source pixels) for a Studio
 * crop, or null when nothing is trimmed. Hotspot fractions are relative to
 * the whole image, which is how the CDN reads them alongside `rect`.
 */
function cropRect(dims: string, crop: SanityImage["crop"]): string | null {
  if (!crop) return null;
  const m = /^(\d+)x(\d+)$/.exec(dims);
  if (!m) return null;
  const W = Number(m[1]);
  const H = Number(m[2]);
  const f = (v: number | undefined) => Math.min(0.95, Math.max(0, v ?? 0));
  const left = Math.round(f(crop.left) * W);
  const top = Math.round(f(crop.top) * H);
  const right = Math.round(f(crop.right) * W);
  const bottom = Math.round(f(crop.bottom) * H);
  const width = W - left - right;
  const height = H - top - bottom;
  if (width <= 0 || height <= 0 || (left === 0 && top === 0 && right === 0 && bottom === 0)) return null;
  return `${left},${top},${width},${height}`;
}

/** A `rect` string back as fractions of the full image. */
function rectFractions(rect: string, dims: string): { left: number; top: number; width: number; height: number } | null {
  const m = /^(\d+)x(\d+)$/.exec(dims);
  const [l, t, w, h] = rect.split(",").map(Number);
  if (!m || [l, t, w, h].some((v) => !Number.isFinite(v))) return null;
  const W = Number(m[1]);
  const H = Number(m[2]);
  return { left: l! / W, top: t! / H, width: w! / W, height: h! / H };
}

/** Ratio helpers for the fixed image formats. */
/** Work tiles are square, as on the previous site. */
export const RATIO = { hero: 16 / 9, work: 1, portrait: 1, cover: 4 / 5 } as const;

/** Cropped URL for a fixed ratio at a given width. */
export function ratioUrl(
  image: SanityImage | null | undefined,
  ratio: number,
  width: number,
  opts: { saturation?: number; crop?: SanityImage["crop"] } = {},
): string | null {
  return imageUrl(image, { width, height: Math.round(width / ratio), fit: "crop", ...opts });
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
  makerNative?: string | null;
  artist?: { name: string | null; nameNative: string | null; slug: string | null } | null;
  year?: string | null;
  provenance?: string | null;
  literature?: string | null;
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
  /** How the square tile is drawn: a flat work fitted on white, or an object centred on its extended backdrop. Absent until the sync has decided. */
  presentation?: "flat" | "object" | null;
  /** The pre-rendered square for an object (sync-made from the first image). */
  tile?: SanityImage | null;
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

export interface Seo {
  title: string | null;
  description: string | null;
  ogImage?: SanityImage | null;
}

export interface PrivateView {
  _key: string;
  label: string | null;
  start: string | null;
  end: string | null;
  access: "invitation" | "rsvp" | "open" | null;
  note: string | null;
}

export interface Exhibition {
  _id: string;
  title: string | null;
  slug: string | null;
  subtitle: string | null;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  datePrecision: "day" | "month" | null;
  privateViews: PrivateView[] | null;
  isArtFair: boolean | null;
  fairName: string | null;
  stand: string | null;
  coverImage: SanityImage | null;
  heroImages: SanityImage[] | null;
  intro: PortableBlock[] | null;
  longText: PortableBlock[] | null;
  pdfUrl: string | null;
  works: Work[] | null;
  /** Inventory lists attached to the event; their web-visible works follow the chosen works. */
  workLists: { _id: string; name: string | null; works: Work[] | null }[] | null;
  /** Editor-arranged order across every source; works not listed follow it A to Z by artist. */
  workOrder: string[] | null;
  catalogue: CatalogueEntry[] | null;
  seo: Seo | null;
  /** Neighbours in the chronological archive, for the ← / → links. */
  prev: { title: string | null; slug: string | null } | null;
  next: { title: string | null; slug: string | null } | null;
  /** Catalogue publication linked to this event, if any. */
  relatedPublication: { title: string | null; slug: string | null } | null;
}

export interface Artist {
  _id: string;
  name: string | null;
  nameNative: string | null;
  slug: string | null;
  lifeDates: string | null;
  country: string | null;
  period: string | null;
  /** Biographies travel with the artist page only; the index leaves them out. */
  bioShort?: string | null;
  bioLong?: string | null;
  portrait: SanityImage | null;
  /** A picture standing in for a missing portrait; see ArtistStandIn. */
  placeholder?: ArtistStandIn | null;
  works?: Work[] | null;
  shownIn?: { title: string | null; slug: string | null; startDate?: string | null; endDate?: string | null }[] | null;
  publications?: { title: string | null; slug: string | null; publishedYear?: number | null }[] | null;
  /** The artist's works in past exhibitions' catalogues (imported from the old site), newest show first. */
  catalogueWorks?: { slug: string | null; title: string | null; entries: CatalogueEntry[] | null }[] | null;
}

/**
 * What stands in for a missing portrait: the newest published work with a
 * picture, or failing that the artist's entry in the newest past exhibition
 * catalogue (imported from the old site). The site shows a close detail of it.
 */
export interface ArtistStandIn {
  kind: "work" | "catalogue";
  image: SanityImage | null;
  title: string | null;
  /** The work's slug, or the exhibition's for a catalogue entry. */
  slug: string | null;
  /** The past exhibition a catalogue entry comes from. */
  show?: { title: string | null; date: string | null } | null;
}

/**
 * A work as it appeared in a past exhibition — CMS-owned, migrated from the
 * old site. Not a reference to the inventory-synced `work` type.
 */
export interface CatalogueEntry {
  _key: string;
  image: SanityImage | null;
  reference: string | null;
  title: string | null;
  maker: string | null;
  /** Set by the matching script: the artist page this entry belongs to. */
  artistSlug?: string | null;
  makerDates: string | null;
  medium: string | null;
  originAndDate: string | null;
  dimensions: string | null;
  sold: boolean | null;
}

/** Lightweight shape returned by the exhibitions index query. */
export interface ExhibitionListItem {
  _id: string;
  title: string | null;
  slug: string | null;
  subtitle: string | null;
  venue: string | null;
  startDate: string | null;
  endDate: string | null;
  datePrecision: "day" | "month" | null;
  privateViews: PrivateView[] | null;
  isArtFair: boolean | null;
  fairName: string | null;
  coverImage: SanityImage | null;
  /** First 16:9 hero image, falling back to the cover — for the slideshow. */
  hero: SanityImage | null;
  workCount: number | null;
  catalogueCount: number | null;
}

/** Lightweight shape returned by the publications index query. */
export interface PublicationListItem {
  _id: string;
  title: string | null;
  slug: string | null;
  coverImage: SanityImage | null;
  publishedYear: number | null;
  availability: "available" | "outOfPrint" | null;
  externalUrl: string | null;
}

export interface Publication {
  _id: string;
  title: string | null;
  slug: string | null;
  coverImage: SanityImage | null;
  description: PortableBlock[] | null;
  spreads: SanityImage[] | null;
  publishedYear: number | null;
  pages: number | null;
  format: string | null;
  language: string | null;
  availability: "available" | "outOfPrint" | null;
  pdfUrl: string | null;
  externalUrl: string | null;
  relatedExhibition: { title: string | null; slug: string | null } | null;
  seo: Seo | null;
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
  visitNote: string | null;
  instagram: string | null;
  galleryPhoto: SanityImage | null;
  statementHeadline: string | null;
  statement: PortableBlock[] | null;
  pressLinks: { _key: string; title: string | null; source: string | null; url: string | null }[] | null;
  socials: { _key: string; label: string | null; url: string | null }[] | null;
  defaultSeo: {
    title: string | null;
    description: string | null;
    ogImage: SanityImage | null;
  } | null;
  featuredWorks: Work[] | null;
  /** Meta pixel ID, set in Sanity so it can go live without a deploy. */
  facebookPixelId: string | null;
  legalName?: string | null;
  companyNumber?: string | null;
  registeredOffice?: string | null;
  vatNumber?: string | null;
  tradeMemberships?: string | null;
  dpContactEmail?: string | null;
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
  makerNative,
  artist->{ name, nameNative, "slug": slug.current },
  year,
  provenance,
  literature,
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
  images[]{ _key, asset, caption, role, hotspot },
  presentation,
  tile{ asset }
}`;

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0]{
  legalName, companyNumber, registeredOffice, vatNumber, tradeMemberships, dpContactEmail,
  galleryName,
  tagline,
  aboutTeaser,
  address,
  email,
  phone,
  openingHours,
  visitNote,
  instagram,
  galleryPhoto{ asset, caption, hotspot },
  statementHeadline,
  statement,
  pressLinks[]{ _key, title, source, url },
  socials[]{ _key, label, url },
  defaultSeo{ title, description, ogImage{ asset } },
  featuredWorks[]->${workFields},
  facebookPixelId
}`;

/**
 * Paginated works list, filterable by category slug.
 * Pass $category = "" for "all".
 */
/* Shared predicate: category facet + a tokenised text search across the
   catalogue fields (prefix wildcard so partial words match). */
const worksMatch = /* groq */ `
  _type == "work" &&
  defined(slug.current) &&
  ($category == "" || categorySlug == $category) &&
  ($q == "" ||
    title match ($q + "*") ||
    maker match ($q + "*") ||
    medium match ($q + "*") ||
    period match ($q + "*") ||
    originRegion match ($q + "*") ||
    stockNumber match ($q + "*"))
`;

export const worksQuery = groq`{
  "items": *[${worksMatch}] | order(_createdAt desc) [$offset...$end] ${workFields},
  "total": count(*[${worksMatch}]),
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

/* Fields for the exhibitions index (no dereferenced works — lightweight). */
const exhibitionListFields = /* groq */ `{
  _id,
  title,
  "slug": slug.current,
  subtitle,
  venue,
  startDate,
  endDate,
  datePrecision,
  privateViews[]{ _key, label, start, end, access, note },
  isArtFair,
  fairName,
  coverImage{ asset, caption, hotspot },
  "hero": coalesce(heroImages[0], coverImage){ asset, caption, hotspot },
  "workCount": count(works),
  "catalogueCount": count(catalogue)
}`;

/** Hidden documents are kept in the CMS but neither listed nor served. */
const visible = /* groq */ `!coalesce(hidden, false)`;

/**
 * All exhibitions, most-recently-ending first. Migrated shows without dates
 * fall back to the old site's order (sortOrder) until dates are entered.
 */
export const exhibitionsQuery = groq`*[_type == "exhibition" && defined(slug.current) && ${visible}]
  | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc)
  ${exhibitionListFields}`;

const catalogueFields = /* groq */ `{
  _key,
  image{ asset, caption },
  reference,
  title,
  maker,
  "artistSlug": artist->slug.current,
  makerDates,
  medium,
  originAndDate,
  dimensions,
  sold
}`;

const eventNeighbour = /* groq */ `{ title, "slug": slug.current }`;

export const exhibitionBySlugQuery = groq`*[_type == "exhibition" && slug.current == $slug && ${visible}][0]{
  _id,
  title,
  "slug": slug.current,
  subtitle,
  venue,
  startDate,
  endDate,
  datePrecision,
  privateViews[]{ _key, label, start, end, access, note },
  isArtFair,
  fairName,
  stand,
  coverImage{ asset, caption, hotspot },
  heroImages[]{ _key, asset, caption, hotspot },
  intro,
  longText,
  "pdfUrl": pdf.asset->url,
  works[]->${workFields},
  workLists[]->{ _id, name, works[]->${workFields} },
  "workOrder": workOrder[]._ref,
  catalogue[]${catalogueFields},
  seo{ title, description, ogImage{ asset } },
  "relatedPublication": *[_type == "publication" && references(^._id) && !coalesce(hidden, false)][0]${eventNeighbour},
  "prev": *[_type == "exhibition" && defined(slug.current) && !coalesce(hidden, false)
    && coalesce(endDate, startDate, "0000") < coalesce(^.endDate, ^.startDate, "0000")]
    | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc)[0]${eventNeighbour},
  "next": *[_type == "exhibition" && defined(slug.current) && !coalesce(hidden, false)
    && coalesce(endDate, startDate, "0000") > coalesce(^.endDate, ^.startDate, "0000")]
    | order(coalesce(endDate, startDate, "0000") asc, coalesce(sortOrder, 9999) desc)[0]${eventNeighbour}
}`;

export const exhibitionSlugsQuery = groq`*[_type == "exhibition" && defined(slug.current) && ${visible}].slug.current`;

export const publicationsQuery = groq`*[_type == "publication" && defined(slug.current) && ${visible}]
  | order(coalesce(publishedYear, 0) desc, coalesce(sortOrder, 9999) asc, title asc){
  _id,
  title,
  "slug": slug.current,
  coverImage{ asset, caption, hotspot },
  publishedYear,
  availability,
  externalUrl
}`;

export const publicationBySlugQuery = groq`*[_type == "publication" && slug.current == $slug && ${visible}][0]{
  _id,
  title,
  "slug": slug.current,
  coverImage{ asset, caption, hotspot },
  description,
  spreads[]{ _key, asset, caption },
  publishedYear,
  pages,
  format,
  language,
  availability,
  "pdfUrl": pdf.asset->url,
  externalUrl,
  relatedExhibition->{ title, "slug": slug.current },
  seo{ title, description, ogImage{ asset } }
}`;

export const publicationSlugsQuery = groq`*[_type == "publication" && defined(slug.current) && ${visible}].slug.current`;

/* Artists — synced from the inventory's makers. */
/* What a tile needs: the index carries no biographies. */
const artistTileFields = /* groq */ `
  _id, name, nameNative, "slug": slug.current, lifeDates, country, period,
  portrait{ asset, caption, hotspot, crop },
  "placeholder": coalesce(
    *[_type == "work" && references(^._id) && defined(images[0].asset) && defined(slug.current)]
      | order(_createdAt desc)[0]{ "kind": "work", "image": images[0]{ asset, hotspot, crop }, title, "slug": slug.current },
    *[_type == "exhibition" && !coalesce(hidden, false) && defined(slug.current)
      && count(catalogue[(artist._ref == ^.^._id || maker == ^.^.name) && defined(image.asset)]) > 0]
      | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc)[0]{
        "kind": "catalogue", "slug": slug.current, "show": { title, "date": coalesce(startDate, endDate) },
        ...coalesce(
          catalogue[(artist._ref == ^.^._id || maker == ^.^.name) && defined(image.asset) && defined(title)][0]{ image{ asset, hotspot, crop }, title },
          catalogue[(artist._ref == ^.^._id || maker == ^.^.name) && defined(image.asset)][0]{ image{ asset, hotspot, crop }, title }
        )
      }
  )`;

const artistFields = /* groq */ `{
  ${artistTileFields},
  bioShort, bioLong
}`;

export const artistsQuery = groq`*[_type == "artist" && defined(slug.current) && !coalesce(hidden, false)]
  | order(name asc){ ${artistTileFields} }`;

export const artistBySlugQuery = groq`*[_type == "artist" && slug.current == $slug && !coalesce(hidden, false)][0]{
  ...${artistFields},
  "works": *[_type == "work" && references(^._id) && defined(slug.current)] | order(_createdAt desc)${workFields},
  "shownIn": *[_type == "exhibition" && !coalesce(hidden, false) && defined(slug.current)
    && (count(works[@->artist._ref == ^.^._id]) > 0
      || count(workLists[]->works[defined(@->artist) && @->artist._ref == ^.^._id]) > 0
      || count(catalogue[artist._ref == ^.^._id || maker == ^.^.name]) > 0)]
    | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc){ title, "slug": slug.current, startDate, endDate },
  "publications": *[_type == "publication" && !coalesce(hidden, false) && defined(slug.current)
    && relatedExhibition->_id in *[_type == "exhibition"
      && (count(works[@->artist._ref == ^.^.^._id]) > 0
        || count(workLists[]->works[defined(@->artist) && @->artist._ref == ^.^.^._id]) > 0
        || count(catalogue[artist._ref == ^.^.^._id || maker == ^.^.^.name]) > 0)]._id]
    | order(coalesce(publishedYear, 0) desc){ title, "slug": slug.current, publishedYear },
  "catalogueWorks": *[_type == "exhibition" && !coalesce(hidden, false) && defined(slug.current)
    && count(catalogue[(artist._ref == ^.^._id || maker == ^.^.name) && defined(image.asset)]) > 0]
    | order(coalesce(endDate, startDate, "0000") desc, coalesce(sortOrder, 9999) asc){
      "slug": slug.current, title,
      "entries": catalogue[(artist._ref == ^.^._id || maker == ^.^.name) && defined(image.asset)]${catalogueFields}
    }
}`;

export const artistSlugsQuery = groq`*[_type == "artist" && defined(slug.current) && !coalesce(hidden, false)].slug.current`;

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
