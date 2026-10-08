import Image from "next/image";
import { ratioUrl, type Artist, type SanityImage } from "@/lib/sanity";

type Subject = Pick<Artist, "name" | "portrait" | "placeholder">;

/**
 * The square an artist is known by on the site: the portrait in black and
 * white, framed on the face by the hotspot the inventory sets; or, with no
 * portrait, a close detail of one of the artist's works in its own colours;
 * or, with neither, the initial of the name set light on the field ground.
 * The initial is decoration (the name stands beside every tile), so it is
 * hidden from assistive technology.
 */
export function ArtistPortrait({
  subject,
  width = 700,
  sizes,
  priority,
  className = "",
}: {
  subject: Subject;
  /** Width the CDN renders at; the square follows. */
  width?: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const picture = artistPicture(subject, width);
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-field ${className}`} style={{ containerType: "inline-size" }}>
      {picture ? (
        <Image
          src={picture.src}
          alt={picture.alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="absolute bottom-[-0.05em] left-[7%] font-sans font-light leading-none text-light opacity-70 select-none"
          style={{ fontSize: "50cqw" }}
        >
          {initialOf(subject.name)}
        </span>
      )}
    </div>
  );
}

/** The square for an artist (portraits black and white, work details in colour), or null when there is no picture to make one from. */
export function artistPicture(subject: Subject, width: number): { src: string; alt: string; kind: "portrait" | "detail" } | null {
  const name = subject.name ?? "Artist";
  if (subject.portrait?.asset) {
    const src = ratioUrl(subject.portrait, 1, width, { saturation: -100 });
    if (src) return { src, alt: name, kind: "portrait" };
  }
  const work = subject.placeholder;
  if (work?.image?.asset) {
    const src = ratioUrl(work.image, 1, width, { crop: detailCrop(work.image) });
    if (src) return { src, alt: work.title ? `${work.title} by ${name}, detail` : `A work by ${name}, detail`, kind: "detail" };
  }
  return null;
}

/**
 * The window on a work that stands in for a portrait: the middle half of
 * the picture, pulled towards the Studio hotspot when one is set, so the
 * tile reads as a detail rather than a thumbnail of the whole object.
 */
function detailCrop(image: SanityImage): NonNullable<SanityImage["crop"]> {
  const SPAN = 0.5;
  const cx = typeof image.hotspot?.x === "number" ? image.hotspot.x : 0.5;
  const cy = typeof image.hotspot?.y === "number" ? image.hotspot.y : 0.5;
  const left = Math.min(Math.max(cx - SPAN / 2, 0), 1 - SPAN);
  const top = Math.min(Math.max(cy - SPAN / 2, 0), 1 - SPAN);
  return { left, top, right: 1 - SPAN - left, bottom: 1 - SPAN - top };
}

/** The letter an artist files under: the first letter of the name, accents folded, as in the A to Z. */
export function initialOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().normalize("NFD").replace(/[̀-ͯ]/g, "")[0] ?? "";
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}
