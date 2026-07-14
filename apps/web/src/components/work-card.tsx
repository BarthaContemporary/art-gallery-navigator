import Image from "next/image";
import Link from "next/link";
import { imageUrl, type Work } from "@/lib/sanity";

/** Alt text for a work image: caption first, then a sensible composite. */
export function workImageAlt(work: Work, caption?: string | null): string {
  if (caption) return caption;
  return (
    [work.title, work.maker, work.period].filter(Boolean).join(", ") || "Artwork"
  );
}

/**
 * Uniform 4:5 image frame on the washi-2 ground. Objects are always contained,
 * never cropped. With no image, a quiet label-caps placeholder stands in — the
 * frame is never a broken img.
 */
export function ImageFrame({
  src,
  alt,
  sizes,
  priority,
  placeholder = "Image forthcoming",
  ratio = "aspect-[4/5]",
  pad = "p-6",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  placeholder?: string;
  ratio?: string;
  pad?: string;
}) {
  return (
    <div className={`relative ${ratio} w-full overflow-hidden bg-washi-2`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={`object-contain ${pad}`}
        />
      ) : (
        <span className="label absolute inset-0 flex items-center justify-center text-ink-50">
          {placeholder}
        </span>
      )}
    </div>
  );
}

export function WorkCard({ work }: { work: Work }) {
  const hero = work.images?.[0] ?? null;
  const src = imageUrl(hero, { width: 900 });

  return (
    <Link
      href={`/works/${work.slug}`}
      className="group block focus-visible:outline-offset-4"
    >
      <ImageFrame
        src={src}
        alt={workImageAlt(work, hero?.caption)}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      />
      <div className="mt-4 space-y-1">
        <p className="font-sans text-ui font-medium text-sumi transition-colors group-hover:text-oranje">
          {work.title ?? "Untitled"}
        </p>
        {work.maker ? (
          <p className="font-serif text-ui text-ink-70">{work.maker}</p>
        ) : null}
        {work.medium ? (
          <p className="font-serif text-ui text-ink-70">{work.medium}</p>
        ) : null}
        {work.stockNumber ? (
          <p className="label pt-1">{work.stockNumber}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function WorkGrid({ works }: { works: Work[] }) {
  if (works.length === 0) {
    return (
      <p className="py-12 font-serif text-body text-ink-50">
        No works to show yet.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {works.map((work) => (
        <li key={work._id}>
          <WorkCard work={work} />
        </li>
      ))}
    </ul>
  );
}
