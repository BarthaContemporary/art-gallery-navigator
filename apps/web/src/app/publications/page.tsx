import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  imageUrl,
  publicationsQuery,
  sanityFetch,
  type PublicationListItem,
} from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Publications",
  description:
    "Exhibition catalogues and publications on Indian and Japanese art.",
};

export default async function PublicationsPage() {
  const publications = await sanityFetch<PublicationListItem[]>({
    query: publicationsQuery,
    tags: ["publication"],
    fallback: [],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-12 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
          Publications
        </h1>
        <p className="mt-3 leading-relaxed text-ink-muted">
          Catalogues and publications accompanying the gallery&rsquo;s
          exhibitions.
        </p>
      </header>

      {publications.length === 0 ? (
        <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
          Catalogues will appear here.
        </p>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {publications.map((publication) => {
            const src = imageUrl(publication.coverImage, { width: 800 });
            return (
              <li key={publication._id}>
                <Link
                  href={`/publications/${publication.slug}`}
                  className="group block rounded-card focus-visible:outline-offset-4"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-placeholder">
                    {src ? (
                      <Image
                        src={src}
                        alt={
                          publication.coverImage?.caption ??
                          publication.title ??
                          "Publication"
                        }
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <span className="sr-only">No cover image</span>
                    )}
                  </div>
                  <h2 className="mt-3 text-base font-semibold leading-snug text-ink-strong">
                    {publication.title}
                  </h2>
                  {publication.publishedYear ? (
                    <p className="mt-1 font-mono text-xs tracking-tight text-ink-soft">
                      {publication.publishedYear}
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
