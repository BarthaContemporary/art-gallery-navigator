"use client";

import Link from "next/link";
import { RatioImage } from "./ratio-image";
import { RATIO, type ExhibitionListItem } from "@/lib/sanity";
import { eventPlace, eventYear } from "@/lib/events";

/** 16:9 tile + title + "venue · year" (handoff 2a). */
export function EventTile({ event, priority = false }: { event: ExhibitionListItem; priority?: boolean }) {
  const place = eventPlace(event);
  const year = eventYear(event);
  // "TEFAF Maastricht 2026 · 2026" reads twice; keep the year once.
  const sub = [place, year && !place?.includes(year) ? year : null].filter(Boolean).join(" · ");
  return (
    <Link href={`/events/${event.slug}`} className="group block">
      <RatioImage
        image={event.coverImage}
        ratio={RATIO.hero}
        width={900}
        alt={event.coverImage?.caption ?? event.title ?? "Event"}
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        priority={priority}
      />
      <h3 className="mt-2.5 font-sans text-ui font-medium leading-snug text-ink group-hover:text-accent">
        {event.title}
      </h3>
      {sub ? <p className="mt-0.5 font-sans text-meta text-meta">{sub}</p> : null}
    </Link>
  );
}
