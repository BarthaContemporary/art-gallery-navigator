import Link from "next/link";
import { imageUrl, type ExhibitionListItem } from "@/lib/sanity";
import { ImageFrame } from "@/components/work-card";

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

/** Four-digit year for the row rail. */
export function exhibitionYear(
  ex: { startDate: string | null; endDate: string | null },
): string | null {
  const ref = ex.startDate ?? ex.endDate;
  if (!ref) return null;
  const d = new Date(ref);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getFullYear());
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

function venueOf(exhibition: ExhibitionListItem): string | null {
  return exhibition.isArtFair
    ? [exhibition.fairName, exhibition.venue].filter(Boolean).join(" · ") ||
        "Art fair"
    : exhibition.venue;
}

/**
 * Index row — year rail / title / dates / status. The whole row is a link;
 * hover tints the title oranje.
 */
export function ExhibitionRow({
  exhibition,
}: {
  exhibition: ExhibitionListItem;
}) {
  const dates = formatExhibitionDates(exhibition.startDate, exhibition.endDate);
  const year = exhibitionYear(exhibition);
  const status = isCurrentExhibition(exhibition) ? "Current" : "Past";
  const venue = venueOf(exhibition);

  return (
    <Link
      href={`/exhibitions/${exhibition.slug}`}
      className="group grid grid-cols-12 gap-x-6 gap-y-2 border-t border-hairline py-8"
    >
      <span className="label col-span-2 self-start pt-1.5 md:col-span-1">
        {year ?? "—"}
      </span>
      <div className="col-span-10 md:col-span-7">
        <h3 className="font-sans text-[24px] font-medium leading-tight tracking-tight text-sumi transition-colors group-hover:text-oranje md:text-[28px]">
          {exhibition.title}
        </h3>
        {exhibition.subtitle ? (
          <p className="mt-1 font-serif text-ui text-ink-70">
            {exhibition.subtitle}
          </p>
        ) : null}
        {venue ? (
          <p className="mt-1 font-serif text-ui text-ink-50">{venue}</p>
        ) : null}
      </div>
      <div className="col-span-12 md:col-span-4 md:text-right">
        {dates ? (
          <p className="font-serif text-ui text-ink-70">{dates}</p>
        ) : null}
        <p className="label mt-1 md:justify-end">{status}</p>
      </div>
    </Link>
  );
}

/**
 * Featured hero — image on cols 1–8, text block bottom-aligned on cols 10–12.
 * Caption sits below the image, never over it.
 */
export function ExhibitionHero({
  exhibition,
}: {
  exhibition: ExhibitionListItem;
}) {
  const dates = formatExhibitionDates(exhibition.startDate, exhibition.endDate);
  const src = imageUrl(exhibition.coverImage, { width: 1800 });
  const venue = venueOf(exhibition);
  const status = isCurrentExhibition(exhibition) ? "Current" : "Past";

  return (
    <Link href={`/exhibitions/${exhibition.slug}`} className="group grid12">
      <div className="col-span-12 lg:col-span-8">
        <ImageFrame
          src={src}
          alt={exhibition.coverImage?.caption ?? exhibition.title ?? "Exhibition"}
          sizes="(min-width: 1024px) 66vw, 100vw"
          priority
          ratio="aspect-[3/2]"
          pad="p-0"
        />
      </div>
      <div className="col-span-12 flex flex-col justify-end lg:col-span-3 lg:col-start-10">
        <p className="label">{status}</p>
        <h2 className="mt-3 font-sans text-h2 font-medium tracking-tight text-sumi transition-colors group-hover:text-oranje">
          {exhibition.title}
        </h2>
        {exhibition.subtitle ? (
          <p className="mt-2 font-serif text-lead font-light text-ink-70">
            {exhibition.subtitle}
          </p>
        ) : null}
        {venue ? (
          <p className="mt-3 font-serif text-ui text-ink-70">{venue}</p>
        ) : null}
        {dates ? (
          <p className="mt-1 font-serif text-ui text-ink-50">{dates}</p>
        ) : null}
      </div>
    </Link>
  );
}
