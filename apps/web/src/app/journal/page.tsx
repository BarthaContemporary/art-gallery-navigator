import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { imageUrl, journalPostsQuery, sanityFetch, type JournalPost } from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Journal",
  description: "Notes on works, makers and collecting Japanese and Indian art.",
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function JournalPage() {
  const posts = await sanityFetch<JournalPost[]>({
    query: journalPostsQuery,
    tags: ["journalPost"],
    fallback: [],
  });

  return (
    <div className="page py-16">
      <header className="grid12">
        <div className="col-span-12 md:col-span-8">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Journal
          </h1>
          <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
            Notes on works, makers and the pleasures of collecting.
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="mt-16 py-12 font-serif text-body text-ink-50">
          The first entries are being written.
        </p>
      ) : (
        <ul className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const src = imageUrl(post.cover, { width: 900 });
            return (
              <li key={post._id}>
                <Link href={`/journal/${post.slug}`} className="group block">
                  <div className="relative aspect-[3/2] w-full overflow-hidden bg-washi-2">
                    {src ? (
                      <Image
                        src={src}
                        alt={post.cover?.caption ?? post.title ?? "Journal post"}
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
                  {post.publishedAt ? (
                    <time
                      dateTime={post.publishedAt}
                      className="label mt-4 block"
                    >
                      {dateFormatter.format(new Date(post.publishedAt))}
                    </time>
                  ) : null}
                  <h2 className="mt-2 font-sans text-ui font-medium text-sumi transition-colors group-hover:text-oranje">
                    {post.title}
                  </h2>
                  {post.excerpt ? (
                    <p className="mt-1 line-clamp-3 max-w-[var(--measure)] font-serif text-ui text-ink-70">
                      {post.excerpt}
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
