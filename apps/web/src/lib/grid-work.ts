import type { CatalogueEntry, SanityImage, Work } from "@/lib/sanity";

/**
 * One shape for every work tile on the site, whether the work is current
 * stock synced from the inventory (`work`) or a CMS-owned catalogue entry
 * from a past exhibition. The panel and enquiry form only ever see this.
 */
export type GridWork = {
  /** Stable id used in the `?work=` URL: the work slug or the catalogue _key. */
  id: string;
  image: SanityImage | null;
  artist: string | null;
  artistNative: string | null;
  artistSlug: string | null;
  artistDates: string | null;
  title: string | null;
  code: string | null;
  medium: string | null;
  dimensions: string | null;
  /** "Japan, c. 1930" / "1962" — origin and date, or year, or period. */
  origin: string | null;
  description: string | null;
  provenance: string | null;
  literature: string | null;
  status: "available" | "sold" | null;
  /** Inventory piece id — recorded against the enquiry when present. */
  pieceId: string | null;
};

export function workToGrid(w: Work): GridWork | null {
  if (!w.slug) return null;
  return {
    id: w.slug,
    image: w.images?.[0] ?? null,
    artist: w.artist?.name ?? w.maker,
    artistNative: w.artist?.nameNative ?? w.makerNative ?? null,
    artistSlug: w.artist?.slug ?? null,
    artistDates: w.makerLifeDates,
    title: w.title,
    code: w.stockNumber,
    medium: w.medium,
    dimensions: w.dimensionsDisplay,
    origin: [w.originRegion, w.year ?? w.period].filter(Boolean).join(", ") || null,
    description: w.description,
    provenance: w.provenance ?? null,
    literature: w.literature ?? null,
    status: w.available === false ? "sold" : w.available ? "available" : null,
    pieceId: w.supabaseId,
  };
}

export function catalogueToGrid(c: CatalogueEntry): GridWork {
  return {
    id: c._key,
    image: c.image,
    artist: c.maker,
    artistNative: null,
    artistSlug: null,
    artistDates: c.makerDates,
    title: c.title,
    code: c.reference,
    medium: c.medium,
    dimensions: c.dimensions,
    origin: c.originAndDate,
    description: null,
    provenance: null,
    literature: null,
    status: c.sold ? "sold" : null,
    pieceId: null,
  };
}

/** "Title | Code" — the caption's first line. */
export function workCaption(w: GridWork): string {
  return [w.title, w.code].filter(Boolean).join(" | ") || "Untitled";
}

/** Subject line for an enquiry: "HARA Satoshi, Title | Code". */
export function workSubject(w: GridWork): string {
  return [w.artist, workCaption(w)].filter(Boolean).join(", ");
}
