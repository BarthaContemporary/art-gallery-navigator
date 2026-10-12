/**
 * schema.org JSON-LD for every route, built in one place.
 *
 * Each page renders a single `<JsonLd data={...} />` holding an @graph; the
 * root layout adds the WebSite and the gallery. Nodes point at one another by
 * @id, so the gallery is described once per page and every event, book and
 * artwork refers to it rather than repeating it.
 *
 * Rules kept here so pages stay simple:
 * - Nothing is invented. A field the CMS does not hold is left out.
 * - An event gets an ExhibitionEvent node only when it has what Google
 *   requires (name, a full start date, a location with an address); otherwise
 *   the page is described as a CollectionPage, which Google does not reject.
 * - Works without a title (the page captions them "Untitled") are not
 *   described as artworks; at most MAX_ARTWORKS are described per page.
 * - Artist URLs appear only while ARTISTS_UNDER_CONSTRUCTION is false.
 */
import {
  imageUrl,
  ratioUrl,
  type Artist,
  type Exhibition,
  type Publication,
  type SanityImage,
  type SiteSettings,
} from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION, absoluteUrl, fallbackGalleryName, siteUrl } from "@/lib/site";
import { artistLead, clip, eventDescription, HOME_DESCRIPTION, oneLine, publicationDescription } from "@/lib/seo";
import type { GridWork } from "@/lib/grid-work";

export type JsonLdNode = Record<string, unknown>;

const HOME = `${siteUrl}/`;
export const GALLERY_ID = `${siteUrl}/#gallery`;
export const WEBSITE_ID = `${siteUrl}/#website`;


/** What the gallery deals in, from the About page and the exhibition history. */
const KNOWS_ABOUT = [
  "20th-century Japanese art",
  "Japanese bronzes",
  "Japanese metalwork",
  "Japanese ceramics",
  "Japanese bamboo art",
  "Japanese lacquer",
  "Gutai",
  "Mingei",
  "Indian art",
  "Indian bronzes",
  "Tantric art",
  "Jain art",
];

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

/** Drops null, undefined, blank strings, empty arrays and objects that hold only an @type. */
function prune(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const out = value.map(prune).filter((v) => v !== undefined);
    return out.length > 0 ? out : undefined;
  }
  if (typeof value === "object") {
    const out: JsonLdNode = {};
    for (const [k, v] of Object.entries(value as JsonLdNode)) {
      const p = prune(v);
      if (p !== undefined) out[k] = p;
    }
    const keys = Object.keys(out);
    return keys.length === 0 || (keys.length === 1 && keys[0] === "@type") ? undefined : out;
  }
  return value;
}

/** One JSON-LD document: the context and the given nodes as an @graph. */
export function graph(...nodes: (JsonLdNode | null | undefined | false)[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter((n): n is JsonLdNode => !!n).map((n) => prune(n)).filter(Boolean),
  };
}

const ref = (id: string): JsonLdNode => ({ "@id": id });





/** 16:9, 4:3 and 1:1 crops on the Studio hotspot: the three ratios Google asks for. */
function imageSet(img: SanityImage | null | undefined): string[] | undefined {
  if (!img?.asset) return undefined;
  return [ratioUrl(img, 16 / 9, 1600), ratioUrl(img, 4 / 3, 1600), ratioUrl(img, 1, 1200)].filter(
    (u): u is string => !!u,
  );
}

/* ------------------------------------------------------------------ */
/* Addresses                                                           */
/* ------------------------------------------------------------------ */

const COUNTRY_CODES: Record<string, string> = {
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  netherlands: "NL",
  "the netherlands": "NL",
  france: "FR",
  "united states": "US",
  usa: "US",
  japan: "JP",
  india: "IN",
};
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/**
 * A free-text Studio address as a PostalAddress. Lines or commas separate the
 * parts; a part with a number is the street, a known country becomes its ISO
 * code, a UK postcode is lifted out, the rest is the locality. So
 * "St. James's, London\nUnited Kingdom" gives locality "St. James's, London",
 * country GB, and "12 Duke Street\nLondon SW1Y 6BN\nUnited Kingdom" gives all four.
 */
export function postalAddress(raw: string | null | undefined): JsonLdNode | undefined {
  const parts = (raw ?? "").split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  let addressCountry: string | undefined;
  let postalCode: string | undefined;
  const street: string[] = [];
  const locality: string[] = [];
  for (const p of parts) {
    const country = COUNTRY_CODES[p.toLowerCase().replace(/\.$/, "")];
    if (country) {
      addressCountry = country;
      continue;
    }
    const pc = UK_POSTCODE.exec(p);
    if (pc) {
      postalCode = `${pc[1]} ${pc[2]}`.toUpperCase();
      const rest = p.replace(pc[0], "").trim();
      if (rest) locality.push(rest);
      continue;
    }
    (/\d/.test(p) ? street : locality).push(p);
  }
  return {
    "@type": "PostalAddress",
    streetAddress: street.join(", "),
    addressLocality: locality.join(", "),
    postalCode,
    addressCountry,
  };
}

/* ------------------------------------------------------------------ */
/* Site-wide: WebSite + ArtGallery (root layout)                       */
/* ------------------------------------------------------------------ */

export function websiteNode(settings: SiteSettings | null): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: settings?.galleryName ?? fallbackGalleryName,
    url: HOME,
    inLanguage: "en-GB",
    publisher: ref(GALLERY_ID),
  };
}

export function galleryNode(settings: SiteSettings | null): JsonLdNode {
  const sameAs = [
    ...new Set(
      [settings?.instagram, ...(settings?.socials ?? []).map((s) => s?.url)].filter(
        (u): u is string => !!u && /^https:\/\//.test(u),
      ),
    ),
  ];
  return {
    "@type": "ArtGallery",
    "@id": GALLERY_ID,
    name: settings?.galleryName ?? fallbackGalleryName,
    legalName: settings?.legalName,
    url: HOME,
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png"), width: 512, height: 512 },
    image: imageUrl(settings?.galleryPhoto, { width: 1600 }),
    description: oneLine(settings?.defaultSeo?.description ?? settings?.tagline) ?? HOME_DESCRIPTION,
    email: settings?.email,
    telephone: settings?.phone,
    address: postalAddress(settings?.address),
    vatID: settings?.vatNumber,
    // Open by appointment only, which openingHoursSpecification cannot say;
    // hours are left out (unknown) rather than declared, and the reserve
    // action points at the appointment form.
    potentialAction: {
      "@type": "ReserveAction",
      name: "Request an appointment",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/about") },
    },
    founder: { "@type": "Person", name: "Joost van den Bergh" },
    areaServed: "Worldwide",
    knowsAbout: KNOWS_ABOUT,
    sameAs,
  };
}

/** Root layout: `<JsonLd data={siteJsonLd(settings)} />`. */
export function siteJsonLd(settings: SiteSettings | null): JsonLdNode {
  return graph(websiteNode(settings), galleryNode(settings));
}

/* ------------------------------------------------------------------ */
/* Breadcrumbs                                                         */
/* ------------------------------------------------------------------ */

export function breadcrumbNode(pageUrl: string, trail: { name: string | null | undefined; path: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: oneLine(t.name) ?? "Untitled",
      item: absoluteUrl(t.path),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const ROMAN = /^(I{1,3}|IV|V|VI{1,3}|IX|X)$/;
const isCapsWord = (t: string) => t.length > 1 && !ROMAN.test(t) && t === t.toUpperCase() && t !== t.toLowerCase();
const titleCase = (t: string) => t.charAt(0) + t.slice(1).toLowerCase();

/**
 * The inventory writes the family name in capitals ("SEKINE Yoshio",
 * "Hideko FUKUSHIMA"). Returns the name in ordinary case, the family and given
 * names when exactly one word is in capitals, and the other name order.
 */
export function splitName(raw: string): { name: string; familyName?: string; givenName?: string; alternate?: string } {
  const words = raw.replace(/\s+/g, " ").trim().split(" ");
  const name = words.map((w) => (isCapsWord(w) ? titleCase(w) : w)).join(" ");
  const caps = words.filter(isCapsWord);
  if (caps.length !== 1) return { name };
  const suffix = words.filter((w) => ROMAN.test(w));
  const given = words.filter((w) => !isCapsWord(w) && !ROMAN.test(w));
  if (given.length === 0) return { name };
  const familyName = titleCase(caps[0]!);
  const givenName = given.join(" ");
  const familyFirst = words.indexOf(caps[0]!) === 0;
  const alternate = (familyFirst ? [givenName, familyName, ...suffix] : [familyName, givenName, ...suffix]).join(" ");
  return { name, familyName, givenName, alternate };
}

/**
 * Birth and death years from the free-text life dates: "1898–1984",
 * "1905-86", "(1911-1987)", "b. 1950", "b.1948–", "died 1986". Anything
 * vaguer ("active 1920s–30s", a lone "1964") gives nothing.
 */
export function lifeYears(raw: string | null | undefined): { birthDate?: string; deathDate?: string } {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s || /active|fl\.|circa|\bc\./i.test(s)) return {};
  const range = /^\(?(\d{4}) ?[-–—] ?(\d{2}|\d{4})\)?$/.exec(s);
  if (range) {
    const born = Number(range[1]);
    let died = Number(range[2]);
    if (range[2]!.length === 2) {
      died += Math.floor(born / 100) * 100;
      if (died <= born) died += 100;
    }
    return died > born && died - born < 120 ? { birthDate: String(born), deathDate: String(died) } : {};
  }
  const born = /^b\. ?(\d{4}) ?[-–—]?$/i.exec(s) ?? /^born (\d{4})$/i.exec(s);
  if (born) return { birthDate: born[1] };
  const died = /^(?:d\.|died) ?(\d{4})$/i.exec(s);
  if (died) return { deathDate: died[1] };
  return {};
}

const COUNTRY_NAMES: Record<string, string> = { usa: "United States", us: "United States", uk: "United Kingdom" };

function personRef(name: string, slug: string | null | undefined): JsonLdNode {
  const url = slug && !ARTISTS_UNDER_CONSTRUCTION ? absoluteUrl(`/artists/${slug}`) : undefined;
  return { "@type": "Person", "@id": url ? `${url}#person` : undefined, name: splitName(name).name, url };
}

/**
 * Artist data plus two fields proposed for the maker sync: `altNames`
 * (makers.alt_names, already in the inventory) and `sameAs` (a new
 * makers.same_as list of Wikipedia / Wikidata / museum URLs). Artist
 * documents are rewritten by the sync, so these cannot be Studio-only fields.
 */
export type ArtistInput = Artist & { sameAs?: string[] | null; altNames?: string[] | null };

/** Artist page main entity. `portrait` is the square portrait URL, never a stand-in detail of a work. */
export function personNode(
  a: ArtistInput,
  portrait?: string | null,
): JsonLdNode | null {
  if (!a.slug || !a.name) return null;
  const url = absoluteUrl(`/artists/${a.slug}`);
  const n = splitName(a.name);
  const country = oneLine(a.country);
  return {
    "@type": "Person",
    "@id": `${url}#person`,
    name: n.name,
    alternateName: [...new Set([n.alternate, oneLine(a.nameNative), ...(a.altNames ?? []).map(oneLine)])].filter(
      (x) => x && x !== n.name,
    ),
    familyName: n.familyName,
    givenName: n.givenName,
    url,
    mainEntityOfPage: url,
    image: portrait ?? undefined,
    description: clip(artistLead(a), 300),
    ...lifeYears(a.lifeDates),
    nationality: country ? { "@type": "Country", name: COUNTRY_NAMES[country.toLowerCase()] ?? country } : undefined,
    sameAs: (a.sameAs ?? []).filter((u) => /^https:\/\//.test(u)),
  };
}

/* ------------------------------------------------------------------ */
/* Works                                                               */
/* ------------------------------------------------------------------ */

/** A single year of making, or nothing when the date is a range, a decade or approximate. */
function yearMade(text: string | null | undefined): string | undefined {
  const s = text ?? "";
  if (/\b(c\.|ca\.|circa|century|period)|\d['’]?s\b|\d{4} ?[-–] ?\d{2}/i.test(s)) return undefined;
  const years = [...new Set(s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/g) ?? [])];
  return years.length === 1 ? years[0] : undefined;
}

type Side = "height" | "width" | "depth";
const LABELS: Record<string, Side | "length" | "diameter"> = {
  h: "height", height: "height",
  w: "width", width: "width",
  d: "depth", depth: "depth",
  l: "length", length: "length",
  dia: "diameter", diameter: "diameter", "ø": "diameter",
};

/**
 * Height, width and depth from the caption ("H 61 × W 50 cm (framed)",
 * "Height: 21.5 cm (8 1/2 in) Diameter: 20 cm", "h: 48 cm w: 38 cm",
 * "27 x 24 x 3 cm"). A diameter or length fills width, then depth. Values in
 * inches only, or with no unit, are left out.
 */
export function dimensions(text: string | null | undefined): Partial<Record<Side, JsonLdNode>> {
  const s = (text ?? "").replace(/\([^)]*\)/g, " ").replace(/,/g, " ");
  const unit = /\bmm\b/i.test(s) && !/\bcm\b/i.test(s) ? "MMT" : /\bcm\b|\dcm/i.test(s) ? "CMT" : null;
  if (!unit) return {};
  const q = (v: string): JsonLdNode => ({ "@type": "QuantitativeValue", value: Number(v), unitCode: unit });
  const out: Partial<Record<Side, JsonLdNode>> = {};
  const labelled = [...s.matchAll(/(?:^|[^a-zø])(height|width|depth|length|diameter|dia|h|w|d|l|ø)\s*[:.]?\s*(\d+(?:\.\d+)?)/gi)];
  if (labelled.length > 0) {
    for (const m of labelled) {
      const label = LABELS[m[1]!.toLowerCase()];
      const value = m[2]!;
      if (label === "height" || label === "width" || label === "depth") out[label] ??= q(value);
      else if (!out.width) out.width = q(value);
      else out.depth ??= q(value);
    }
    return out;
  }
  const plain = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?\s*(?:cm|mm)\b/i.exec(s);
  if (plain) {
    out.height = q(plain[1]!);
    out.width = q(plain[2]!);
    if (plain[3]) out.depth = q(plain[3]);
  }
  return out;
}

/**
 * A work tile as a VisualArtwork. `pageUrl` is the page it is shown on; the
 * work has no page of its own, so its @id is a fragment of that page.
 */
export function artworkNode(w: GridWork, pageUrl: string): JsonLdNode | null {
  const name = oneLine(w.title);
  if (!name || !w.image?.asset) return null;
  const artist = oneLine(w.artist);
  return {
    "@type": "VisualArtwork",
    "@id": `${pageUrl}#work-${w.id}`,
    name,
    image: imageUrl(w.image, { width: 1200 }),
    creator: artist ? personRef(artist, w.artistSlug) : undefined,
    dateCreated: yearMade(w.origin),
    artMedium: oneLine(w.medium),
    ...dimensions(w.dimensions),
    // Place and date as catalogued ("Western India, 19th century"); medium and size have their own fields.
    description: oneLine(w.origin),
  };
}

/**
 * Works described per page. App Router repeats every server-rendered script in
 * the RSC payload, so each node is shipped twice; the first works in the
 * page's own order carry the meaning, the long tail only weight.
 */
export const MAX_ARTWORKS = 40;

function artworks(works: GridWork[], pageUrl: string): JsonLdNode[] {
  return works
    .map((w) => artworkNode(w, pageUrl))
    .filter((n): n is JsonLdNode => !!n)
    .slice(0, MAX_ARTWORKS);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/** Venues used again and again, so a fair needs no address typed in. Addresses from the organisers. */
const KNOWN_VENUES: { test: RegExp; name: string; address: JsonLdNode }[] = [
  {
    test: /tefaf maastricht|\bmecc\b/i,
    name: "MECC Maastricht",
    address: { "@type": "PostalAddress", streetAddress: "Forum 100", postalCode: "6229 GV", addressLocality: "Maastricht", addressCountry: "NL" },
  },
  {
    test: /frieze masters/i,
    name: "Frieze Masters, The Regent's Park",
    address: { "@type": "PostalAddress", streetAddress: "Gloucester Green, The Regent's Park", postalCode: "NW1 4HA", addressLocality: "London", addressCountry: "GB" },
  },
  {
    test: /asian art in london/i,
    name: "Asian Art in London",
    address: { "@type": "PostalAddress", addressLocality: "London", addressCountry: "GB" },
  },
];

/** Exhibition plus the optional `venueAddress` text field proposed for the Studio. */
export type EventInput = Exhibition & { venueAddress?: string | null };

/** "Frieze Masters - The Regent's Park - Stand B03" without the stand, which has its own field. */
function venueName(ev: EventInput): string | undefined {
  const venue = oneLine(ev.venue?.replace(/\s*[-–·,]?\s*Stand\s+\S+\s*$/i, ""));
  return oneLine([ev.isArtFair ? ev.fairName : null, venue && venue !== ev.fairName ? venue : null].filter(Boolean).join(", "));
}

function eventLocation(ev: EventInput, galleryName: string): JsonLdNode | undefined {
  const typed = postalAddress(ev.venueAddress);
  const name = venueName(ev);
  if (typed) return { "@type": "Place", name: name ?? galleryName, address: typed };
  const known = KNOWN_VENUES.find((v) => v.test.test(`${ev.fairName ?? ""} ${ev.venue ?? ""}`));
  if (known) return { "@type": "Place", name: known.name, address: known.address };
  // "Gallery" is how the old site wrote a show in the gallery's own rooms.
  // London is certain; the street of a past show is not, so it is not guessed.
  if (/^gallery$/i.test(ev.venue?.trim() ?? "")) {
    return { "@type": "Place", name: galleryName, address: { "@type": "PostalAddress", addressLocality: "London", addressCountry: "GB" } };
  }
  return undefined;
}

/** Event page: `<JsonLd data={eventJsonLd(ev, settings, works)} />` with the page's GridWork list. */
export function eventJsonLd(ev: EventInput, settings: SiteSettings | null, works: GridWork[]): JsonLdNode {
  const slug = ev.slug ?? "";
  const url = absoluteUrl(`/events/${slug}`);
  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const title = oneLine(ev.title) ?? "Event";
  const shown = artworks(works, url);
  // Same sentence as the meta description (lib/seo.ts).
  const description = eventDescription(ev);
  const image = imageSet(ev.seo?.ogImage ?? ev.heroImages?.find((i) => i?.asset) ?? ev.coverImage);
  const location = eventLocation(ev, galleryName);
  const fullDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined);
  const startDate = ev.datePrecision === "month" ? undefined : fullDate(ev.startDate);

  const main: JsonLdNode =
    startDate && location
      ? {
          "@type": "ExhibitionEvent",
          "@id": `${url}#event`,
          name: title,
          url,
          description,
          startDate,
          endDate: fullDate(ev.endDate) ?? startDate,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          location,
          image,
          organizer: { "@type": "ArtGallery", "@id": GALLERY_ID, name: galleryName, url: HOME },
          workFeatured: shown.map((a) => ref(a["@id"] as string)),
        }
      : {
          // Undated or unplaced (old-site imports): described, but not offered to Google as an event.
          "@type": "CollectionPage",
          "@id": `${url}#page`,
          name: title,
          url,
          description,
          image,
          isPartOf: ref(WEBSITE_ID),
          hasPart: shown.map((a) => ref(a["@id"] as string)),
        };

  return graph(breadcrumbNode(url, [{ name: "Events", path: "/" }, { name: title, path: `/events/${slug}` }]), main, ...shown);
}

/* ------------------------------------------------------------------ */
/* Artists                                                             */
/* ------------------------------------------------------------------ */

/** Artist page: `<JsonLd data={artistJsonLd(a, portraitSrc, [...works, ...catalogueWorks])} />`. */
export function artistJsonLd(
  a: ArtistInput,
  portrait: string | null | undefined,
  works: GridWork[],
): JsonLdNode {
  const url = absoluteUrl(`/artists/${a.slug ?? ""}`);
  const person = personNode(a, portrait);
  return graph(
    breadcrumbNode(url, [{ name: "Artists", path: "/artists" }, { name: splitName(a.name ?? "Artist").name, path: `/artists/${a.slug ?? ""}` }]),
    person,
    ...artworks(works, url),
  );
}

/* ------------------------------------------------------------------ */
/* Publications                                                        */
/* ------------------------------------------------------------------ */

const LANGUAGE_CODES: Record<string, string> = { english: "en", japanese: "ja", dutch: "nl", french: "fr", german: "de" };

/** Publication page: `<JsonLd data={publicationJsonLd(p, settings)} />`. `isbn` is the proposed Studio field. */
export function publicationJsonLd(p: Publication & { isbn?: string | null }, settings: SiteSettings | null): JsonLdNode {
  const slug = p.slug ?? "";
  const url = absoluteUrl(`/publications/${slug}`);
  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const title = oneLine(p.title) ?? "Catalogue";
  const description = publicationDescription(p);
  const book: JsonLdNode = {
    "@type": "Book",
    "@id": `${url}#book`,
    name: title,
    url,
    description,
    image: imageUrl(p.seo?.ogImage ?? p.coverImage, { width: 1200 }),
    datePublished: p.publishedYear ? String(p.publishedYear) : undefined,
    numberOfPages: p.pages ?? undefined,
    inLanguage: LANGUAGE_CODES[(p.language ?? "").trim().toLowerCase()] ?? oneLine(p.language),
    size: oneLine(p.format),
    isbn: oneLine(p.isbn)?.replace(/[^\dX]/gi, ""),
    publisher: { "@type": "ArtGallery", "@id": GALLERY_ID, name: galleryName },
    about: p.relatedExhibition?.slug ? ref(`${absoluteUrl(`/events/${p.relatedExhibition.slug}`)}#event`) : undefined,
  };
  return graph(breadcrumbNode(url, [{ name: "Publications", path: "/publications" }, { name: title, path: `/publications/${slug}` }]), book);
}

/* ------------------------------------------------------------------ */
/* About                                                               */
/* ------------------------------------------------------------------ */

/** About page: `<JsonLd data={aboutJsonLd()} />`. The gallery itself comes from the layout. */
export function aboutJsonLd(): JsonLdNode {
  const url = absoluteUrl("/about");
  return graph({
    "@type": "AboutPage",
    "@id": `${url}#page`,
    url,
    name: "About",
    isPartOf: ref(WEBSITE_ID),
    about: ref(GALLERY_ID),
    mainEntity: ref(GALLERY_ID),
  });
}
