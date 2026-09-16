import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artistBySlugQuery, artistSlugsQuery, imageUrl, sanityFetch, RATIO, type Artist } from "@/lib/sanity";
import { absoluteUrl } from "@/lib/site";
import { workToGrid, type GridWork } from "@/lib/grid-work";
import { RatioImage } from "@/components/ratio-image";
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
  const title = [a.name, a.nameNative].filter(Boolean).join(" ");
  const description = a.bioShort?.slice(0, 200) ?? [a.lifeDates, a.country, a.period].filter(Boolean).join(" · ") ?? undefined;
  const ogImage = imageUrl(a.portrait, { width: 1200 });
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/artists/${slug}`) },
    openGraph: { title, description, type: "profile", url: absoluteUrl(`/artists/${slug}`), images: ogImage ? [{ url: ogImage }] : undefined },
  };
}

function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n|\n/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Artist detail (handoff 2d): name with the kanji greyed beside it, a short
 * meta line, biography in two registers, the 1:1 portrait on the right;
 * then the works grid with the same fold-out, and back-references.
 */
export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArtist(slug);
  if (!a) notFound();

  const meta = [a.lifeDates, a.country, a.period].filter(Boolean).join(" · ");
  const works: GridWork[] = (a.works ?? []).map(workToGrid).filter((w): w is GridWork => w !== null);
  const shownIn = (a.shownIn ?? []).filter((e) => e?.slug);
  const publications = (a.publications ?? []).filter((p) => p?.slug);
  const bioShort = paragraphs(a.bioShort);
  const bioLong = paragraphs(a.bioLong);

  return (
    <article className="page pt-12 pb-24 md:pt-16">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: a.name ?? undefined,
          alternateName: a.nameNative ?? undefined,
          url: absoluteUrl(`/artists/${slug}`),
          image: imageUrl(a.portrait, { width: 800 }) ?? undefined,
          description: a.bioShort ?? undefined,
        }}
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_120px] md:gap-12">
        <header className="max-w-[640px]">
          <h1 className="t-title">
            {a.name}
            {a.nameNative ? <span className="ml-3 text-light">{a.nameNative}</span> : null}
          </h1>
          {meta ? <p className="mt-3 font-sans text-small text-meta">{meta}</p> : null}
          {bioShort.length > 0 ? (
            <div className="mt-6 flex flex-col gap-5 font-sans text-body text-body">
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
        {a.portrait?.asset ? (
          <div className="w-[120px] md:w-full">
            <RatioImage image={a.portrait} ratio={RATIO.portrait} width={400} alt={a.name ?? "Portrait"} sizes="120px" priority />
          </div>
        ) : null}
      </div>

      {works.length > 0 ? (
        <section className="mt-16 md:mt-20">
          <WorksFoldout works={works} label="Works" />
        </section>
      ) : null}

      {shownIn.length > 0 || publications.length > 0 ? (
        <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 md:mt-20">
          {shownIn.length > 0 ? (
            <section>
              <h2 className="label">Shown in</h2>
              <ul className="mt-3 flex flex-col">
                {shownIn.map((e) => (
                  <li key={e.slug}>
                    <Link href={`/events/${e.slug}`} className="inline-flex min-h-[40px] items-center font-sans text-ui text-ink hover:text-accent">
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {publications.length > 0 ? (
            <section>
              <h2 className="label">Publications</h2>
              <ul className="mt-3 flex flex-col">
                {publications.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/publications/${p.slug}`} className="inline-flex min-h-[40px] items-center font-sans text-ui text-ink hover:text-accent">
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
}
