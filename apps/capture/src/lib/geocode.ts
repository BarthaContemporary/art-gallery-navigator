/**
 * Reverse-geocode a phone's GPS fix into a likely purchase source. Because this
 * is an art dealer buying stock, we PRIORITISE nearby art galleries and antique
 * dealers over whatever generic business happens to be closest, then fall back
 * to the nearest establishment, then to a plain street address. Uses the Google
 * Places "Nearby Search" + reverse geocoding APIs (same key as the studio).
 */
export type CaptureSourceType =
  | "gallery"
  | "dealer"
  | "auction"
  | "fair"
  | "private"
  | "other";

export type ResolvedSource = {
  source_name: string | null;
  source_address: string | null;
  source_type: CaptureSourceType | null;
};

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// J.v.d.B.'s own premises. Several St James's neighbours (Ben Hunter,
// Littleton & Hennessy, Christie's) sit close enough that a GPS fix taken at his
// own door resolves to their storefront — so any of those aliases is forced to
// the home base below.
const HOME_BASE: ResolvedSource = {
  source_name: "Joost van den Bergh",
  source_address: "St James's, London",
  source_type: "gallery",
};
const HOME_BASE_ALIASES = [
  "ben hunter",
  "littleton & hennessy",
  "littleton and hennessy",
  "christie's",
  "christies",
];
function isHomeBaseAlias(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return HOME_BASE_ALIASES.some((a) => n.includes(a));
}

// How far a prioritised gallery/antique hit may be and still be treated as
// "where I am" (GPS + being outside the door needs some slack).
const PRIORITY_RADIUS_M = 300;

type Hit = {
  name: string;
  address: string | null;
  types: string[];
  dist: number;
};

function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest place matching the given params (type and/or keyword), with distance. */
async function nearest(
  lat: number,
  lng: number,
  params: Record<string, string>,
): Promise<Hit | null> {
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("rankby", "distance");
    url.searchParams.set("key", KEY!);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: {
        name?: string;
        vicinity?: string;
        types?: string[];
        geometry?: { location?: { lat: number; lng: number } };
      }[];
    };
    const top = data.results?.[0];
    if (!top?.name) return null;
    const loc = top.geometry?.location;
    return {
      name: top.name,
      address: top.vicinity ?? null,
      types: top.types ?? [],
      dist: loc ? metres(lat, lng, loc.lat, loc.lng) : Number.POSITIVE_INFINITY,
    };
  } catch {
    return null;
  }
}

function typeFromGoogle(types: string[]): CaptureSourceType | null {
  const t = new Set(types);
  if (t.has("art_gallery") || t.has("museum")) return "gallery";
  if (t.has("store") || t.has("furniture_store") || t.has("home_goods_store")) return "dealer";
  return null;
}

export async function resolveSource(lat: number, lng: number): Promise<ResolvedSource> {
  const resolved = await resolveSourceRaw(lat, lng);
  // St James's neighbours picked up at J.v.d.B.'s own door → home base.
  return isHomeBaseAlias(resolved.source_name) ? { ...HOME_BASE } : resolved;
}

async function resolveSourceRaw(lat: number, lng: number): Promise<ResolvedSource> {
  if (!KEY) return { source_name: null, source_address: null, source_type: null };

  // 1. Prioritise art galleries and antique dealers near the fix.
  const [gallery, antique] = await Promise.all([
    nearest(lat, lng, { type: "art_gallery" }),
    nearest(lat, lng, { keyword: "antique" }),
  ]);
  const priority = [
    gallery ? { hit: gallery, type: "gallery" as CaptureSourceType } : null,
    antique ? { hit: antique, type: "dealer" as CaptureSourceType } : null,
  ]
    .filter((x): x is { hit: Hit; type: CaptureSourceType } => x !== null)
    .filter((x) => x.hit.dist <= PRIORITY_RADIUS_M)
    .sort((a, b) => a.hit.dist - b.hit.dist)[0];
  if (priority) {
    return {
      source_name: priority.hit.name,
      source_address: priority.hit.address,
      source_type: priority.type,
    };
  }

  // 2. Otherwise the nearest named establishment.
  const general = await nearest(lat, lng, {});
  if (general) {
    return {
      source_name: general.name,
      source_address: general.address,
      source_type: typeFromGoogle(general.types),
    };
  }

  // 3. Fall back to a plain street address.
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", KEY);
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { results?: { formatted_address?: string }[] };
      const addr = data.results?.[0]?.formatted_address;
      if (addr) return { source_name: null, source_address: addr, source_type: null };
    }
  } catch {
    /* ignore */
  }

  return { source_name: null, source_address: null, source_type: null };
}
