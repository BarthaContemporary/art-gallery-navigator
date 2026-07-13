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
    <article className="page py-10">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <nav aria-label="Breadcrumb" className="label mb-8">
            <Link href="/journal" className="hover:text-oranje">
              &larr; Journal
            </Link>
          </nav>

          <header>
            {post.publishedAt ? (
              <time dateTime={post.publishedAt} className="label">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(post.publishedAt))}
              </time>
            ) : null}
            <h1 className="mt-3 font-sans text-h1 font-medium tracking-tight text-sumi">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-4 max-w-[var(--measure)] font-serif text-lead font-light text-ink-70">
                {post.excerpt}
              </p>
            ) : null}
          </header>
        </div>
      </div>

      {coverSrc && coverDims ? (
        <figure className="mt-10">
          <Image
            src={coverSrc}
            alt={post.cover?.caption ?? post.title ?? ""}
            width={coverDims.width}
            height={coverDims.height}
            priority
            sizes="100vw"
            className="w-full bg-washi-2"
          />
          {post.cover?.caption ? (
            <figcaption className="label mt-3">{post.cover.caption}</figcaption>
          ) : null}
        </figure>
      ) : null}

      <div className="mt-12 grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <PortableText value={post.body} />
        </div>
      </div>
    </article>
  );
}
