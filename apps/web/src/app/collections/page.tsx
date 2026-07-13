import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { collectionsQuery, imageUrl, sanityFetch, type Collection } from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Collections",
  description: "Curated groupings of Japanese and Indian works of art.",
};

export default async function CollectionsPage() {
  const collections = await sanityFetch<Collection[]>({
    query: collectionsQuery,
    tags: ["collection"],
    fallback: [],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Collections</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Curated groupings of works — by school, material or theme.
        </p>
      </header>

      {collections.length === 0 ? (
        <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
          Collections are being prepared.
        </p>
      ) : (
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const src = imageUrl(collection.cover, { width: 900 });
            return (
              <li key={collection._id}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="group block rounded-card"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-placeholder">
                    {src ? (
                      <Image
                        src={src}
                        alt={collection.cover?.caption ?? collection.title ?? "Collection"}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <h2 className="mt-3 font-medium text-ink-strong">{collection.title}</h2>
                  {collection.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
                      {collection.description}
                    </p>
                  ) : null}
                  {typeof collection.workCount === "number" ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      {collection.workCount} work{collection.workCount === 1 ? "" : "s"}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
