import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionBySlugQuery, sanityFetch, type Collection } from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";
import { WorkGrid } from "@/components/work-card";

async function getCollection(slug: string): Promise<Collection | null> {
  return sanityFetch<Collection | null>({
    query: collectionBySlugQuery,
    params: { slug },
    tags: ["collection", "work"],
    fallback: null,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.title ?? "Collection",
    description: collection.description ?? undefined,
    alternates: { canonical: absoluteUrl(`/collections/${slug}`) },
    openGraph: {
      title: collection.title ?? "Collection",
      description: collection.description ?? undefined,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  const works = (collection.works ?? []).filter((w) => w?.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/collections" className="hover:text-ink-strong">
              Collections
            </Link>
          </li>
          <li aria-hidden className="text-ink-separator">
            /
          </li>
          <li aria-current="page" className="text-ink-mid">
            {collection.title}
          </li>
        </ol>
      </nav>

      <header className="mb-10 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-3 leading-relaxed text-ink-muted">{collection.description}</p>
        ) : null}
      </header>

      <WorkGrid works={works} />
    </div>
  );
}
