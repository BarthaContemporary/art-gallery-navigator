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
    <div className="page py-16">
      <header className="grid12">
        <div className="col-span-12 md:col-span-8">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Collections
          </h1>
          <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
            Curated groupings of works — by school, material or theme.
          </p>
        </div>
      </header>

      {collections.length === 0 ? (
        <p className="mt-16 py-12 font-serif text-body text-ink-50">
          Collections are being prepared.
        </p>
      ) : (
        <ul className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => {
            const src = imageUrl(collection.cover, { width: 900 });
            return (
              <li key={collection._id}>
                <Link
                  href={`/collections/${collection.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[3/2] w-full overflow-hidden bg-washi-2">
                    {src ? (
                      <Image
                        src={src}
                        alt={collection.cover?.caption ?? collection.title ?? "Collection"}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="label absolute inset-0 flex items-center justify-center text-ink-50">
                        Image forthcoming
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 font-sans text-ui font-medium text-sumi transition-colors group-hover:text-oranje">
                    {collection.title}
                  </h2>
                  {collection.description ? (
                    <p className="mt-1 line-clamp-2 max-w-[var(--measure)] font-serif text-ui text-ink-70">
                      {collection.description}
                    </p>
                  ) : null}
                  {typeof collection.workCount === "number" ? (
                    <p className="label mt-2">
                      {collection.workCount} work
                      {collection.workCount === 1 ? "" : "s"}
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
