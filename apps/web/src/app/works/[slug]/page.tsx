import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSiteSettings,
  imageDimensions,
  imageUrl,
  sanityFetch,
  workBySlugQuery,
  type Work,
} from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName } from "@/lib/site";
import { JsonLd } from "@/components/json-ld";
import { workImageAlt } from "@/components/work-card";

const IMAGE_ROLE_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  side: "Side",
  signature: "Signature",
  box: "Box",
  detail: "Detail",
  condition: "Condition",
};

async function getWork(slug: string): Promise<Work | null> {
  return sanityFetch<Work | null>({
    query: workBySlugQuery,
    params: { slug },
    tags: ["work"],
    fallback: null,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const work = await getWork(slug);
  if (!work) return { title: "Work not found" };

  const title = [work.title ?? "Untitled", work.maker].filter(Boolean).join(" — ");
  const description = [
    work.maker,
    work.period,
    work.originRegion,
    work.medium,
    work.dimensionsDisplay,
  ]
    .filter(Boolean)
    .join(" · ");
  const ogImage = imageUrl(work.images?.[0], { width: 1200 });

  return {
    title,
    description: description || undefined,
    alternates: { canonical: absoluteUrl(`/works/${slug}`) },
    openGraph: {
      title,
      description: description || undefined,
      type: "article",
      url: absoluteUrl(`/works/${slug}`),
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [work, settings] = await Promise.all([getWork(slug), getSiteSettings()]);
  if (!work) notFound();

  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const enquiryEmail = settings?.email ?? "";
  const images = work.images ?? [];
  const hero = images[0] ?? null;
  const heroSrc = imageUrl(hero, { width: 1800 });
  const heroDims = imageDimensions(hero);
  const pageUrl = absoluteUrl(`/works/${slug}`);

  const specs: [string, string | null | undefined, boolean?][] = [
    ["Stock number", work.stockNumber, true],
    ["Maker", [work.maker, work.makerLifeDates].filter(Boolean).join(", ")],
    ["Period", work.period],
    ["Origin", work.originRegion],
    ["Medium", work.medium],
    ["Dimensions", work.dimensionsDisplay],
    ["Price", work.priceDisplay ?? "POA"],
    ["Availability", work.available === false ? "Sold" : "Available"],
  ];

  const artworkJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    name: work.title ?? "Untitled",
    url: pageUrl,
    identifier: work.stockNumber ?? undefined,
    creator: work.maker
      ? { "@type": "Person", name: work.maker, description: work.makerLifeDates ?? undefined }
      : undefined,
    artMedium: work.medium ?? undefined,
    dateCreated: work.period ?? undefined,
    countryOfOrigin: work.originRegion ?? undefined,
    size: work.dimensionsDisplay ?? undefined,
    description: work.description ?? undefined,
    image: heroSrc ?? undefined,
    provider: { "@type": "ArtGallery", name: galleryName },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: galleryName, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Works", item: absoluteUrl("/works") },
      { "@type": "ListItem", position: 3, name: work.title ?? "Untitled", item: pageUrl },
    ],
  };

  const enquirySubject = encodeURIComponent(
    `Enquiry: ${work.title ?? "Untitled"}${work.stockNumber ? ` (${work.stockNumber})` : ""}`,
  );

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={artworkJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/works" className="hover:text-ink-strong">
              Works
            </Link>
          </li>
          <li aria-hidden className="text-ink-separator">
            /
          </li>
          <li aria-current="page" className="text-ink-mid">
            {work.title ?? "Untitled"}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Imagery */}
        <div>
          <figure className="overflow-hidden rounded-hero bg-placeholder">
            {heroSrc && heroDims ? (
              <Image
                src={heroSrc}
                alt={workImageAlt(work, hero?.caption)}
                width={heroDims.width}
                height={heroDims.height}
                priority
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="h-auto w-full object-contain"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm text-ink-faint">
                Photography in preparation
              </div>
            )}
            {hero?.caption ? (
              <figcaption className="px-3 py-2 text-xs text-ink-soft">{hero.caption}</figcaption>
            ) : null}
          </figure>

          {images.length > 1 ? (
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.slice(1).map((image) => {
                const src = imageUrl(image, { width: 600 });
                if (!src) return null;
                const label = image.role ? IMAGE_ROLE_LABELS[image.role] : null;
                return (
                  <li key={image._key ?? src}>
                    <figure>
                      <div className="relative aspect-square overflow-hidden rounded-thumb bg-placeholder">
                        <Image
                          src={src}
                          alt={image.caption ?? label ?? workImageAlt(work)}
                          fill
                          sizes="(min-width: 1024px) 14vw, 30vw"
                          className="object-contain p-2"
                        />
                      </div>
                      {label || image.caption ? (
                        <figcaption className="mt-1 text-[11px] text-ink-soft">
                          {image.caption ?? label}
                        </figcaption>
                      ) : null}
                    </figure>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {/* Details */}
        <div>
          <header>
            {work.maker ? (
              <p className="text-sm font-medium text-ink-mid">
                {work.maker}
                {work.makerLifeDates ? (
                  <span className="text-ink-soft"> ({work.makerLifeDates})</span>
                ) : null}
              </p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-strong">
              {work.title ?? "Untitled"}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              {work.available !== false ? (
                <span className="inline-flex items-center gap-1.5 rounded-tag bg-pill px-2 py-0.5 text-xs text-ink-label">
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full bg-status-green"
                  />
                  Available
                </span>
              ) : (
                <span className="inline-flex items-center rounded-tag bg-pill px-2 py-0.5 text-xs text-ink-label">
                  Sold
                </span>
              )}
              <span className="font-mono text-xs text-ink-soft">{work.stockNumber}</span>
            </p>
          </header>

          {/* Semantic spec list — deliberately a <dl> so answer engines can lift facts. */}
          <dl className="mt-8 divide-y divide-line-soft border-y border-line-soft">
            {specs.map(([label, value, mono]) =>
              value ? (
                <div key={label} className="grid grid-cols-[8rem_1fr] gap-4 py-2.5 text-sm">
                  <dt className="text-ink-label-soft">{label}</dt>
                  <dd className={mono ? "font-mono text-[13px] text-ink-body" : "text-ink-body"}>
                    {value}
                  </dd>
                </div>
              ) : null,
            )}
          </dl>

          {work.description ? (
            <div className="mt-8">
              <h2 className="text-sm font-medium uppercase tracking-wide text-ink-label-soft">
                Description
              </h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-body">
                {work.description}
              </p>
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            {enquiryEmail ? (
              <a
                href={`mailto:${enquiryEmail}?subject=${enquirySubject}`}
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                Enquire about this work
              </a>
            ) : (
              <Link
                href="/contact"
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-6 py-3 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90"
              >
                Enquire about this work
              </Link>
            )}
            <Link
              href="/visit"
              className="inline-flex min-h-11 items-center rounded-control border border-line-control bg-control px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-control-active"
            >
              View in person
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
