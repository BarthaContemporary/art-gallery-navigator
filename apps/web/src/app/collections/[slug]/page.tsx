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
    <div className="page py-16">
      <nav aria-label="Breadcrumb" className="label mb-8">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/collections" className="hover:text-oranje">
              Collections
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{collection.title}</li>
        </ol>
      </nav>

      <header className="mb-16 max-w-[var(--measure)]">
        <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
          {collection.title}
        </h1>
        {collection.description ? (
          <p className="mt-4 font-serif text-lead font-light text-ink-70">
            {collection.description}
          </p>
        ) : null}
      </header>

      <WorkGrid works={works} />
    </div>
  );
}
