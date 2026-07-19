/**
 * Reverse-geocode a phone's GPS fix into a likely purchase source (a named
 * gallery / auction house / dealer, or failing that a street address). Uses
 * the Google Places "Nearby Search" + reverse geocoding APIs — the same key
 * the studio already uses for address autofill.
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

// Map Google place types onto our source enum, best-effort.
function typeFromGoogle(types: string[]): CaptureSourceType | null {
  const t = new Set(types);
  if (t.has("art_gallery")) return "gallery";
  if (t.has("museum")) return "gallery";
  if (t.has("store") || t.has("furniture_store") || t.has("home_goods_store"))
    return "dealer";
  return null;
}

export async function resolveSource(
  lat: number,
  lng: number,
): Promise<ResolvedSource> {
  if (!KEY) return { source_name: null, source_address: null, source_type: null };

  // 1. Nearest named establishment (galleries, auction houses read as businesses).
  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    );
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("rankby", "distance");
    url.searchParams.set("key", KEY);
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: {
          name?: string;
          vicinity?: string;
          types?: string[];
        }[];
      };
      const top = data.results?.[0];
      if (top?.name) {
        return {
          source_name: top.name,
          source_address: top.vicinity ?? null,
          source_type: typeFromGoogle(top.types ?? []),
        };
      }
    }
  } catch {
    /* fall through to reverse geocode */
  }

  // 2. Fall back to a plain street address.
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", KEY);
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as {
        results?: { formatted_address?: string }[];
      };
      const addr = data.results?.[0]?.formatted_address;
      if (addr) return { source_name: null, source_address: addr, source_type: null };
    }
  } catch {
    /* ignore */
  }

  return { source_name: null, source_address: null, source_type: null };
}
