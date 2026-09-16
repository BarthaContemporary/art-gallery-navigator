import type { Metadata } from "next";
import { publicationsQuery, sanityFetch, type PublicationListItem } from "@/lib/sanity";
import { PublicationTile } from "@/components/publication-tile";
import { InfiniteGrid } from "@/components/infinite-grid";

export const metadata: Metadata = {
  title: "Publications",
  description: "Exhibition catalogues and publications on Japanese and Indian art.",
};

export default async function PublicationsPage() {
  const publications = (
    await sanityFetch<PublicationListItem[]>({ query: publicationsQuery, tags: ["publication"], fallback: [] })
  ).filter((p) => p.slug);

  return (
    <div className="page pt-12 pb-24 md:pt-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="t-title">Publications</h1>
        <span className="font-sans text-small text-meta">
          {publications.length} {publications.length === 1 ? "title" : "titles"}
        </span>
      </div>
      <p className="mt-4 max-w-[560px] font-sans text-body text-body">
        Catalogues published to accompany the gallery&rsquo;s exhibitions and fair presentations. Most can be read here in full;
        printed copies are available to order while stocks last.
      </p>
      {publications.length === 0 ? (
        <p className="mt-8 font-sans text-body text-meta">Catalogues will appear here.</p>
      ) : (
        <div className="mt-10">
          <InfiniteGrid pageSize={16}>
            {publications.map((p, i) => (
              <li key={p._id}>
                <PublicationTile publication={p} priority={i < 4} />
              </li>
            ))}
          </InfiniteGrid>
        </div>
      )}
    </div>
  );
}
