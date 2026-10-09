import Image from "next/image";
import { imageDimensions, ratioUrl, type Artist, type SanityImage } from "@/lib/sanity";

type Subject = Pick<Artist, "name" | "portrait" | "placeholder">;

/**
 * The square an artist is known by on the site, always in black and white:
 * the portrait, framed on the face by the hotspot the inventory sets; or,
 * with no portrait, a close detail of one of the artist's works, published
 * or as it appeared in a past exhibition's catalogue; or, with neither, the
 * initial of the name set light on the field ground.
 * The initial is decoration (the name stands beside every tile), so it is
 * hidden from assistive technology.
 */
export function ArtistPortrait({
  subject,
  width = 700,
  sizes,
  priority,
  decorative = false,
  className = "",
}: {
  subject: Subject;
  /** Width the CDN renders at; the square follows. */
  width?: number;
  sizes: string;
  priority?: boolean;
  /** True when the name sits beside the square in the same link or figure caption, so the image needs no text of its own. */
  decorative?: boolean;
  className?: string;
}) {
  const picture = artistPicture(subject, width);
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-field ${className}`} style={{ containerType: "inline-size" }}>
      {picture ? (
        <Image
          src={picture.src}
          alt={decorative ? "" : picture.alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className="object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="initial-mark absolute bottom-[4%] left-[7%] font-sans font-light leading-none text-light opacity-70 select-none"
        >
          {initialOf(subject.name)}
        </span>
      )}
    </div>
  );
}

export type ArtistPicture = {
  src: string;
  alt: string;
  kind: "portrait" | "detail";
  /** Source pixels along the square's side, so a small original is not blown up. */
  nativeSide: number | null;
};

/** The black-and-white square for an artist, or null when there is no picture to make one from. */
export function artistPicture(subject: Subject, width: number): ArtistPicture | null {
  const name = subject.name ?? "Artist";
  if (subject.portrait?.asset) {
    const framed = faceCrop(subject.portrait);
    const src = ratioUrl(subject.portrait, 1, width, { saturation: -100, crop: framed?.crop });
    if (src) {
      const dims = imageDimensions(subject.portrait);
      return { src, alt: `Portrait of ${name}`, kind: "portrait", nativeSide: framed?.side ?? (dims ? Math.min(dims.width, dims.height) : null) };
    }
  }
  const work = subject.placeholder;
  if (work?.image?.asset) {
    const dims = imageDimensions(work.image);
    const src = ratioUrl(work.image, 1, width, { crop: detailCrop(work.image), saturation: -100 });
    if (src) {
      return {
        src,
        alt: work.title ? `${work.title}, detail of a work by ${name}` : `Detail of a work by ${name}`,
        kind: "detail",
        nativeSide: dims ? Math.round(Math.min(dims.width, dims.height) * DETAIL_SPAN) : null,
      };
    }
  }
  return null;
}

/**
 * The caption under a stand-in detail on the artist page: the work's title,
 * and for a catalogue entry the exhibition it comes from, dated by its year
 * unless the exhibition's title already carries one. The year goes before
 * the word "exhibition" so a show named after the artist still reads:
 * "From the 2015 exhibition Watanabe Tadashi".
 */
export function standInCaption(standIn: Artist["placeholder"]): string | null {
  if (!standIn) return null;
  const head = standIn.title ? `${standIn.title}, detail` : null;
  if (standIn.kind !== "catalogue") return head;
  const show = standIn.show?.title?.trim() || null;
  if (!show) return head;
  const year = standIn.show?.date?.slice(0, 4) ?? null;
  const from = year && !show.includes(year) ? `From the ${year} exhibition ${show}` : `From the exhibition ${show}`;
  return head ? `${head}. ${from}` : `Detail of a work. ${from}`;
}

/**
 * A square around the face. The CDN's focal point only slides a full-height
 * (or full-width) window across the picture, so a face near an edge stays
 * near that edge; this takes the face box the inventory detected and cuts
 * the largest square that keeps the face at the centre, never tighter than
 * head and shoulders and never smaller than half the short side. Without a
 * face box, the focal point alone does what it can.
 */
function faceCrop(image: SanityImage): { crop: NonNullable<SanityImage["crop"]>; side: number } | null {
  const dims = imageDimensions(image);
  const hs = image.hotspot;
  if (!dims || !hs || [hs.x, hs.y, hs.width, hs.height].some((v) => typeof v !== "number")) return null;
  const { width: W, height: H } = dims;
  const short = Math.min(W, H);
  const cx = hs.x! * W;
  const cy = hs.y! * H;
  const face = Math.max(hs.width! * W, hs.height! * H);
  const centred = Math.min(short, 2 * cx, 2 * (W - cx), 2 * cy, 2 * (H - cy));
  const side = Math.round(Math.min(short, Math.max(centred, 2.4 * face, 0.5 * short)));
  const left = Math.round(Math.min(Math.max(cx - side / 2, 0), W - side));
  const top = Math.round(Math.min(Math.max(cy - side / 2, 0), H - side));
  return {
    crop: { left: left / W, top: top / H, right: (W - left - side) / W, bottom: (H - top - side) / H },
    side,
  };
}

const DETAIL_SPAN = 0.5;

/**
 * The window on a work that stands in for a portrait: the middle half of
 * the picture, pulled towards the Studio hotspot when one is set, so the
 * tile reads as a detail rather than a thumbnail of the whole object.
 */
function detailCrop(image: SanityImage): NonNullable<SanityImage["crop"]> {
  const SPAN = DETAIL_SPAN;
  const cx = typeof image.hotspot?.x === "number" ? image.hotspot.x : 0.5;
  const cy = typeof image.hotspot?.y === "number" ? image.hotspot.y : 0.5;
  const left = Math.min(Math.max(cx - SPAN / 2, 0), 1 - SPAN);
  const top = Math.min(Math.max(cy - SPAN / 2, 0), 1 - SPAN);
  return { left, top, right: 1 - SPAN - left, bottom: 1 - SPAN - top };
}

/** The letter an artist files under: the first letter of the name, accents folded, as in the A to Z. */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim().normalize("NFD").replace(/[̀-ͯ]/g, ""))[0] ?? "";
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}
