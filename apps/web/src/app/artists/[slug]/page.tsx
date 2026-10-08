import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artistBySlugQuery, artistSlugsQuery, sanityFetch, type Artist } from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION, absoluteUrl } from "@/lib/site";
import { UnderConstruction } from "@/components/under-construction";
import { workToGrid, type GridWork } from "@/lib/grid-work";
import { ArtistPortrait, artistPicture } from "@/components/artist-portrait";
import { ReadMore } from "@/components/read-more";
import { WorksFoldout } from "@/components/works-foldout";
import { JsonLd } from "@/components/json-ld";

async function getArtist(slug: string): Promise<Artist | null> {
  return sanityFetch<Artist | null>({
    query: artistBySlugQuery,
    params: { slug },
    tags: ["artist", "work", "exhibition", "publication"],
    fallback: null,
  });
}

export async function generateStaticParams() {
  const slugs = await sanityFetch<string[]>({ query: artistSlugsQuery, tags: ["artist"], fallback: [] });
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArtist(slug);
  if (!a) return { title: "Artist not found" };
  const robots = ARTISTS_UNDER_CONSTRUCTION ? { index: false, follow: false } : undefined;
  const title = [a.name, a.nameNative].filter(Boolean).join(" ");
  const description = a.bioShort?.slice(0, 200) ?? [a.lifeDates, a.country, a.period].filter(Boolean).join(", ") ?? undefined;
  const ogImage = artistPicture(a, 1200)?.src;
  return {
    robots,
    title,
    description,
    alternates: { canonical: absoluteUrl(`/artists/${slug}`) },
    openGraph: { title, description, type: "profile", url: absoluteUrl(`/artists/${slug}`), images: ogImage ? [{ url: ogImage }] : undefined },
  };
}

function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
}

const year = (iso: string | null | undefined) => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : null);

/**
 * Artist page: the black-and-white square on the left (portrait framed on
 * the face, or a detail of a work), the name with the kanji grey beside it,
 * the facts in one quiet row and the biography in two registers to the
 * right; then the works with the same fold-out as everywhere else, and the
 * exhibitions and publications the artist appears in, each with its year.
 */
export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArtist(slug);
  if (!a) notFound();

  const picture = artistPicture(a, 900);
  const facts = [
    { label: "Dates", value: a.lifeDates },
    { label: "Country", value: a.country },
    { label: "Period", value: a.period },
  ].filter((f): f is { label: string; value: string } => !!f.value);
  // While the pages are locked nothing interactive renders behind the overlay
  // (a ?work= deep link would otherwise scroll to an inert panel).
  const works: GridWork[] = ARTISTS_UNDER_CONSTRUCTION
    ? []
    : (a.works ?? []).map(workToGrid).filter((w): w is GridWork => w !== null);
  const shownIn = (a.shownIn ?? []).filter((e) => e?.slug);
  const publications = (a.publications ?? []).filter((p) => p?.slug);
  const bioShort = paragraphs(a.bioShort);
  const bioLong = paragraphs(a.bioLong);

  const article = (
    <article className="page pt-12 pb-24 md:pt-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: a.name ?? undefined,
          alternateName: a.nameNative ?? undefined,
          url: absoluteUrl(`/artists/${slug}`),
          image: picture?.kind === "portrait" ? picture.src : undefined,
          description: a.bioShort ?? undefined,
        }}
      />

      <div className="grid grid-cols-1 gap-y-8 md:grid-cols-12 md:gap-x-10 lg:gap-x-14">
        {picture ? (
          <figure className="w-full max-w-[240px] md:col-span-4 md:max-w-none lg:col-span-3">
            <ArtistPortrait subject={a} width={900} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 240px" priority />
            {picture.kind === "detail" && a.placeholder?.title ? (
              <figcaption className="mt-2 font-sans text-[12px] text-meta">Detail of {a.placeholder.title}</figcaption>
            ) : a.portrait?.caption ? (
              <figcaption className="mt-2 font-sans text-[12px] text-meta">{a.portrait.caption}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <header className={picture ? "max-w-[var(--measure)] md:col-span-8 lg:col-span-7 lg:col-start-5" : "max-w-[var(--measure)] md:col-span-9"}>
          <h1 className="t-title">
            {a.name}
            {a.nameNative ? <span className="ml-3 text-light">{a.nameNative}</span> : null}
          </h1>
          {facts.length > 0 ? (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-sans text-small text-meta">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd className={f.label === "Dates" ? "tabular" : undefined}>{f.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {bioShort.length > 0 ? (
            <div className="mt-6 flex flex-col gap-5 font-sans text-body">
              {bioShort.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          ) : null}
          {bioLong.length > 0 ? (
            <ReadMore className="mt-1">
              <div className="flex flex-col gap-3 font-sans text-small text-body">
                {bioLong.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </ReadMore>
          ) : null}
        </header>
      </div>

      {works.length > 0 ? (
        <section className="mt-16 md:mt-20">
          <WorksFoldout works={works} label="Works" />
        </section>
      ) : null}

      {shownIn.length > 0 || publications.length > 0 ? (
        <div className="mt-16 grid grid-cols-1 gap-y-12 md:mt-20 md:grid-cols-12 md:gap-x-10 lg:gap-x-14">
          {shownIn.length > 0 ? (
            <section className="md:col-span-6 lg:col-span-5">
              <h2 className="label">Shown in</h2>
              <ul className="mt-3 flex flex-col">
                {shownIn.map((e) => (
                  <li key={e.slug} className="flex items-baseline gap-x-5">
                    <span className="tabular w-10 shrink-0 font-sans text-small text-meta">{year(e.startDate) ?? ""}</span>
                    <Link href={`/events/${e.slug}`} className="inline-flex min-h-[40px] items-center font-sans text-ui text-ink no-underline transition-colors duration-150 hover:text-accent">
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {publications.length > 0 ? (
            <section className="md:col-span-6 lg:col-span-5 lg:col-start-7">
              <h2 className="label">Publications</h2>
              <ul className="mt-3 flex flex-col">
                {publications.map((p) => (
                  <li key={p.slug} className="flex items-baseline gap-x-5">
                    <span className="tabular w-10 shrink-0 font-sans text-small text-meta">{p.publishedYear ?? ""}</span>
                    <Link href={`/publications/${p.slug}`} className="inline-flex min-h-[40px] items-center font-sans text-ui text-ink no-underline transition-colors duration-150 hover:text-accent">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
  return ARTISTS_UNDER_CONSTRUCTION ? <UnderConstruction>{article}</UnderConstruction> : article;
}
