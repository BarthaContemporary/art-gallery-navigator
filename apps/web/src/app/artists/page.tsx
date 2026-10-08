import type { Metadata } from "next";
import { artistsQuery, sanityFetch, type Artist } from "@/lib/sanity";
import { artistCollator } from "@/lib/artist-order";
import { ARTISTS_UNDER_CONSTRUCTION } from "@/lib/site";
import { ArtistsGrid } from "@/components/artists-grid";
import { UnderConstruction } from "@/components/under-construction";

export const metadata: Metadata = {
  title: "Artists",
  description: "Artists and makers represented by the gallery: Japanese and Indian works of art.",
  robots: ARTISTS_UNDER_CONSTRUCTION ? { index: false, follow: false } : undefined,
};

export default async function ArtistsPage() {
  // The stand-in squares come from works, so a work change refreshes the index too.
  const artists = await sanityFetch<Artist[]>({ query: artistsQuery, tags: ["artist", "work"], fallback: [] });
  const grid = (
    <div className="page pt-12 pb-24 md:pt-16">
      <ArtistsGrid
        artists={artists
          .filter((a) => a.slug)
          .sort((a, b) => artistCollator.compare(a.name ?? "", b.name ?? ""))}
      />
    </div>
  );
  return ARTISTS_UNDER_CONSTRUCTION ? <UnderConstruction>{grid}</UnderConstruction> : grid;
}
