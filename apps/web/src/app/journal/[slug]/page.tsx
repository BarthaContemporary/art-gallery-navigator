import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  imageDimensions,
  imageUrl,
  journalPostBySlugQuery,
  sanityFetch,
  type JournalPost,
} from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";
import { PortableText } from "@/components/portable-text";

async function getPost(slug: string): Promise<JournalPost | null> {
  return sanityFetch<JournalPost | null>({
    query: journalPostBySlugQuery,
    params: { slug },
    tags: ["journalPost"],
    fallback: null,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found" };
  const ogImage = imageUrl(post.cover, { width: 1200 });
  return {
    title: post.title ?? "Journal",
    description: post.excerpt ?? undefined,
    alternates: { canonical: absoluteUrl(`/journal/${slug}`) },
    openGraph: {
      title: post.title ?? "Journal",
      description: post.excerpt ?? undefined,
      type: "article",
      publishedTime: post.publishedAt ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const coverSrc = imageUrl(post.cover, { width: 1600 });
  const coverDims = imageDimensions(post.cover);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <Link href="/journal" className="hover:text-ink-strong">
          &larr; Journal
        </Link>
      </nav>

      <header>
        {post.publishedAt ? (
          <time
            dateTime={post.publishedAt}
            className="font-mono text-[11px] text-ink-soft"
          >
            {new Intl.DateTimeFormat("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date(post.publishedAt))}
          </time>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink-strong">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="mt-3 text-lg leading-relaxed text-ink-muted">{post.excerpt}</p>
        ) : null}
      </header>

      {coverSrc && coverDims ? (
        <figure className="mt-8">
          <Image
            src={coverSrc}
            alt={post.cover?.caption ?? post.title ?? ""}
            width={coverDims.width}
            height={coverDims.height}
            priority
            sizes="(min-width: 768px) 42rem, 100vw"
            className="w-full rounded-hero bg-placeholder"
          />
          {post.cover?.caption ? (
            <figcaption className="mt-2 text-xs text-ink-soft">{post.cover.caption}</figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-6">
        <PortableText value={post.body} />
      </div>
    </article>
  );
}
