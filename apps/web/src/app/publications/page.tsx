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
    <div className="page py-16">
      <header className="grid12">
        <div className="col-span-12 md:col-span-8">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Publications
          </h1>
          <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
            Catalogues and publications accompanying the gallery&rsquo;s
            exhibitions.
          </p>
        </div>
      </header>

      {publications.length === 0 ? (
        <p className="mt-16 py-12 font-serif text-body text-ink-50">
          Catalogues will appear here.
        </p>
      ) : (
        <ul className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {publications.map((publication) => {
            const src = imageUrl(publication.coverImage, { width: 800 });
            return (
              <li key={publication._id}>
                <Link
                  href={`/publications/${publication.slug}`}
                  className="group block focus-visible:outline-offset-4"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-washi-2">
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
                        className="object-cover"
                      />
                    ) : (
                      <span className="label absolute inset-0 flex items-center justify-center text-ink-50">
                        Cover forthcoming
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 font-sans text-ui font-medium text-sumi transition-colors group-hover:text-oranje">
                    {publication.title}
                  </h2>
                  {publication.publishedYear ? (
                    <p className="mt-1 font-serif text-ui text-ink-70">
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
