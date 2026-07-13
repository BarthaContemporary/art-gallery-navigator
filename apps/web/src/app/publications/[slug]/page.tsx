import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSiteSettings,
  imageDimensions,
  imageUrl,
  publicationBySlugQuery,
  publicationSlugsQuery,
  sanityFetch,
  type Publication,
} from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";
import { PortableText } from "@/components/portable-text";

async function getPublication(slug: string): Promise<Publication | null> {
  return sanityFetch<Publication | null>({
    query: publicationBySlugQuery,
    params: { slug },
    tags: ["publication"],
    fallback: null,
  });
}

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({
    query: publicationSlugsQuery,
    tags: ["publication"],
    fallback: [],
  });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const publication = await getPublication(slug);
  if (!publication) return { title: "Publication not found" };

  const title = publication.seo?.title ?? publication.title ?? "Publication";
  const description = publication.seo?.description ?? undefined;
  const ogImage =
    imageUrl(publication.seo?.ogImage, { width: 1200 }) ??
    imageUrl(publication.coverImage, { width: 1200 });

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/publications/${slug}`) },
    openGraph: {
      title,
      description,
      type: "article",
      url: absoluteUrl(`/publications/${slug}`),
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [publication, settings] = await Promise.all([
    getPublication(slug),
    getSiteSettings(),
  ]);
  if (!publication) notFound();

  const enquiryEmail = settings?.email ?? "";
  const coverSrc = imageUrl(publication.coverImage, { width: 1200 });
  const coverDims = imageDimensions(publication.coverImage);
  const enquirySubject = encodeURIComponent(
    `Publication enquiry: ${publication.title ?? "Catalogue"}`,
  );

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/publications" className="hover:text-ink-strong">
              Publications
            </Link>
          </li>
          <li aria-hidden className="text-ink-separator">
            /
          </li>
          <li aria-current="page" className="text-ink-mid">
            {publication.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <figure className="overflow-hidden rounded-hero bg-placeholder">
            {coverSrc && coverDims ? (
              <Image
                src={coverSrc}
                alt={
                  publication.coverImage?.caption ??
                  publication.title ??
                  "Publication cover"
                }
                width={coverDims.width}
                height={coverDims.height}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="h-auto w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center text-sm text-ink-faint">
                Cover in preparation
              </div>
            )}
          </figure>
        </div>

        <div>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-strong sm:text-3xl">
              {publication.title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-ink-muted">
              {publication.publishedYear ? (
                <span className="font-mono text-xs tracking-tight text-ink-soft">
                  {publication.publishedYear}
                </span>
              ) : null}
              {publication.relatedExhibition?.slug ? (
                <Link
                  href={`/exhibitions/${publication.relatedExhibition.slug}`}
                  className="underline decoration-ink-separator underline-offset-4 hover:text-ink-strong"
                >
                  {publication.relatedExhibition.title ?? "Related exhibition"}
                </Link>
              ) : null}
            </p>
          </header>

          {publication.description && publication.description.length > 0 ? (
            <div className="mt-6">
              <PortableText value={publication.description} />
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            {enquiryEmail ? (
              <a
                href={`mailto:${enquiryEmail}?subject=${enquirySubject}`}
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                Enquire about this catalogue
              </a>
            ) : (
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                Enquire about this catalogue
              </Link>
            )}
            {publication.externalUrl ? (
              <a
                href={publication.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-control border border-line-control bg-control px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-control-active"
              >
                View / download
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
