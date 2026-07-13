import Image from "next/image";
import Link from "next/link";
import { imageUrl, type Work } from "@/lib/sanity";

/** Alt text for a work image: caption first, then a sensible composite. */
export function workImageAlt(work: Work, caption?: string | null): string {
  if (caption) return caption;
  return [work.title, work.maker, work.period].filter(Boolean).join(", ") || "Artwork";
}

export function WorkCard({ work }: { work: Work }) {
  const hero = work.images?.[0] ?? null;
  const src = imageUrl(hero, { width: 800 });

  return (
    <Link
      href={`/works/${work.slug}`}
      className="group block rounded-grid focus-visible:outline-offset-4"
    >
      <div className="relative aspect-square overflow-hidden rounded-grid bg-placeholder">
        {src ? (
          <Image
            src={src}
            alt={workImageAlt(work, hero?.caption)}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="sr-only">No image available</span>
        )}
      </div>
      <div className="mt-3 space-y-0.5">
        {work.maker ? (
          <p className="text-sm font-medium text-ink-strong">{work.maker}</p>
        ) : null}
        <p className="text-sm text-ink-body">{work.title ?? "Untitled"}</p>
        <p className="text-xs text-ink-muted">
          {[work.period, work.originRegion].filter(Boolean).join(" · ")}
        </p>
        <p className="flex items-baseline justify-between gap-2 pt-0.5">
          <span className="font-mono text-[11px] tracking-tight text-ink-soft">
            {work.stockNumber}
          </span>
          <span className="text-xs text-ink-mid">{work.priceDisplay ?? "POA"}</span>
        </p>
      </div>
    </Link>
  );
}

export function WorkGrid({ works }: { works: Work[] }) {
  if (works.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-cell p-8 text-center text-sm text-ink-muted">
        No works to show yet.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {works.map((work) => (
        <li key={work._id}>
          <WorkCard work={work} />
        </li>
      ))}
    </ul>
  );
}
