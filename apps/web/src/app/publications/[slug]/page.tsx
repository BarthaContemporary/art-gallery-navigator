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
    <article className="page py-10">
      <nav aria-label="Breadcrumb" className="label mb-8">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/publications" className="hover:text-oranje">
              Publications
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page">{publication.title}</li>
        </ol>
      </nav>

      <div className="grid12">
        <div className="col-span-12 lg:col-span-5">
          <figure>
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-washi-2">
              {coverSrc && coverDims ? (
                <Image
                  src={coverSrc}
                  alt={
                    publication.coverImage?.caption ??
                    publication.title ??
                    "Publication cover"
                  }
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <span className="label absolute inset-0 flex items-center justify-center text-ink-50">
                  Cover forthcoming
                </span>
              )}
            </div>
          </figure>
        </div>

        <div className="col-span-12 lg:col-span-6 lg:col-start-7">
          <header>
            <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
              {publication.title}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {publication.publishedYear ? (
                <span className="label">{publication.publishedYear}</span>
              ) : null}
              {publication.relatedExhibition?.slug ? (
                <Link
                  href={`/exhibitions/${publication.relatedExhibition.slug}`}
                  className="link-inline font-sans text-ui text-ink-70"
                >
                  {publication.relatedExhibition.title ?? "Related exhibition"}
                </Link>
              ) : null}
            </p>
          </header>

          {publication.description && publication.description.length > 0 ? (
            <div className="mt-8">
              <PortableText value={publication.description} />
            </div>
          ) : null}

          <div className="mt-10 flex flex-wrap gap-3">
            {enquiryEmail ? (
              <a
                href={`mailto:${enquiryEmail}?subject=${enquirySubject}`}
                className="btn btn-filled"
              >
                Enquire about this catalogue
              </a>
            ) : (
              <Link href="/contact" className="btn btn-filled">
                Enquire about this catalogue
              </Link>
            )}
            {publication.externalUrl ? (
              <a
                href={publication.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
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
