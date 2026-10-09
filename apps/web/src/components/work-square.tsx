import Image from "next/image";
import { imageUrl, ratioUrl, type SanityImage, type Work } from "@/lib/sanity";

export type WorkSquareSubject = Pick<Work, "presentation" | "tile"> & { image: SanityImage | null | undefined };

export type WorkSquarePicture = {
  src: string;
  /** flat: the whole photograph fitted on white; object: the sync-rendered square; crop: the centre crop used before the sync decided. */
  kind: "flat" | "object" | "crop";
};

/**
 * The square a work is shown in on tiles, always in colour. A flat work
 * (painting, work on paper) is fitted whole inside the square on white; an
 * object comes as the square the inventory sync rendered, centred on its
 * studio backdrop with the backdrop extended. A work the sync has not yet
 * classified keeps the centre crop on the field ground.
 */
export function WorkSquare({
  subject,
  width = 800,
  alt,
  sizes,
  priority,
  className = "",
}: {
  subject: WorkSquareSubject;
  /** Width the CDN renders at; the square follows. */
  width?: number;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const picture = workSquare(subject, width);
  const ground = picture?.kind === "crop" ? "bg-field" : "bg-white";
  return (
    <div className={`relative aspect-square w-full overflow-hidden ${ground} ${className}`}>
      {picture ? (
        <Image
          src={picture.src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          className={picture.kind === "flat" ? "object-contain" : "object-cover"}
        />
      ) : null}
    </div>
  );
}

/** The picture for a work's square at a CDN width, or null without an image. */
export function workSquare(subject: WorkSquareSubject, width: number): WorkSquarePicture | null {
  if (subject.presentation === "object" && subject.tile?.asset) {
    const src = ratioUrl(subject.tile, 1, width);
    if (src) return { src, kind: "object" };
  }
  if (subject.presentation === "flat") {
    // The whole photograph inside the square; the CSS centres it on white.
    const src = imageUrl(subject.image, { width, height: width });
    if (src) return { src, kind: "flat" };
  }
  const src = ratioUrl(subject.image, 1, width);
  return src ? { src, kind: "crop" } : null;
}
