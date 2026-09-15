import type { Metadata } from "next";
import { artistsQuery, sanityFetch, type Artist } from "@/lib/sanity";
import { ArtistsGrid } from "@/components/artists-grid";

export const metadata: Metadata = {
  title: "Artists",
  description: "Artists and makers represented by the gallery — Japanese and Indian works of art.",
};

export default async function ArtistsPage() {
  const artists = await sanityFetch<Artist[]>({ query: artistsQuery, tags: ["artist"], fallback: [] });
  return (
    <div className="page pt-10 pb-20 md:pt-12">
      <ArtistsGrid artists={artists.filter((a) => a.slug)} />
    </div>
  );
}
