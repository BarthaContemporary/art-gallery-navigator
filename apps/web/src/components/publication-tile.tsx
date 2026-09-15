"use client";

import Link from "next/link";
import { RatioImage } from "./ratio-image";
import { RATIO, type PublicationListItem } from "@/lib/sanity";
import { availabilityLabel } from "@/lib/publications";

/** 4:5 cover, title, "year · available" (handoff 2e). */
export function PublicationTile({ publication, priority = false }: { publication: PublicationListItem; priority?: boolean }) {
  const meta = [publication.publishedYear ? String(publication.publishedYear) : null, availabilityLabel(publication.availability)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/publications/${publication.slug}`} className="group block">
      <RatioImage
        image={publication.coverImage}
        ratio={RATIO.cover}
        width={800}
        alt={publication.coverImage?.caption ?? publication.title ?? "Publication"}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        priority={priority}
      />
      <h3 className="mt-2.5 font-sans text-ui font-medium leading-snug text-ink group-hover:text-accent">{publication.title}</h3>
      <p className="mt-0.5 font-sans text-meta text-meta">{meta}</p>
    </Link>
  );
}
