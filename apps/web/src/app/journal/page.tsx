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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Journal</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Notes on works, makers and the pleasures of collecting.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
          The first entries are being written.
        </p>
      ) : (
        <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const src = imageUrl(post.cover, { width: 900 });
            return (
              <li key={post._id}>
                <Link href={`/journal/${post.slug}`} className="group block rounded-card">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-placeholder">
                    {src ? (
                      <Image
                        src={src}
                        alt={post.cover?.caption ?? post.title ?? "Journal post"}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  {post.publishedAt ? (
                    <time
                      dateTime={post.publishedAt}
                      className="mt-3 block font-mono text-[11px] text-ink-soft"
                    >
                      {dateFormatter.format(new Date(post.publishedAt))}
                    </time>
                  ) : null}
                  <h2 className="mt-1 font-medium text-ink-strong">{post.title}</h2>
                  {post.excerpt ? (
                    <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{post.excerpt}</p>
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
