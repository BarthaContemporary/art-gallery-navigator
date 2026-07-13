import Image from "next/image";
import Link from "next/link";
import { imageUrl, type ExhibitionListItem } from "@/lib/sanity";

/** Human date range, e.g. "3 March – 12 April 2026". Collapses a shared year. */
export function formatExhibitionDates(
  start: string | null,
  end: string | null,
): string | null {
  const full = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const noYear = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  });

  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const valid = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());

  if (valid(s) && valid(e)) {
    const sameYear = s.getFullYear() === e.getFullYear();
    return `${sameYear ? noYear.format(s) : full.format(s)} – ${full.format(e)}`;
  }
  if (valid(s)) return full.format(s);
  if (valid(e)) return full.format(e);
  return null;
}

/**
 * Current (or upcoming) if there is no end date, or the end date is today
 * or later. Past once the end date has slipped by. Undated shows count as
 * current so they never disappear.
 */
export function isCurrentExhibition(
  ex: { endDate: string | null; startDate: string | null },
  now: Date = new Date(),
): boolean {
  const ref = ex.endDate ?? ex.startDate;
  if (!ref) return true;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() >= today.getTime();
}

export function ExhibitionCard({
  exhibition,
}: {
  exhibition: ExhibitionListItem;
}) {
  const dates = formatExhibitionDates(exhibition.startDate, exhibition.endDate);
  const src = imageUrl(exhibition.coverImage, { width: 1000 });
  const venueLine = exhibition.isArtFair
    ? [exhibition.fairName, exhibition.venue].filter(Boolean).join(" · ") ||
      "Art fair"
    : exhibition.venue;

  return (
    <Link
      href={`/exhibitions/${exhibition.slug}`}
      className="group block rounded-card focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-placeholder">
        {src ? (
          <Image
            src={src}
            alt={exhibition.coverImage?.caption ?? exhibition.title ?? "Exhibition"}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="sr-only">No cover image</span>
        )}
      </div>
      {exhibition.isArtFair ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Art fair
        </p>
      ) : null}
      <h3 className="mt-2 text-base font-semibold leading-snug text-ink-strong">
        {exhibition.title}
      </h3>
      {exhibition.subtitle ? (
        <p className="mt-0.5 text-sm text-ink-muted">{exhibition.subtitle}</p>
      ) : null}
      {venueLine ? (
        <p className="mt-1 text-sm text-ink-muted">{venueLine}</p>
      ) : null}
      {dates ? (
        <p className="mt-1 font-mono text-xs tracking-tight text-ink-soft">
          {dates}
        </p>
      ) : null}
    </Link>
  );
}
