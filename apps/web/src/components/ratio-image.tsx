import Image from "next/image";
import { ratioUrl, type SanityImage } from "@/lib/sanity";

/**
 * Fixed-ratio image on the #ebe8e2 ground, cropped by the CDN (hotspot-aware).
 * The four site ratios: 16:9 hero/event, 3:4 work, 1:1 portrait, 4:5 cover.
 * No border, no radius. With no image the ground stays empty — never a
 * broken img.
 */
export function RatioImage({
  image,
  ratio,
  width = 1200,
  alt,
  sizes,
  priority,
  className = "",
  lazy = true,
}: {
  image: SanityImage | null | undefined;
  ratio: number;
  /** Width the CDN renders at; height follows the ratio. */
  width?: number;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  lazy?: boolean;
}) {
  const src = ratioUrl(image, ratio, width);
  return (
    <div
      className={`relative w-full overflow-hidden bg-field ${className}`}
      style={{ aspectRatio: String(ratio) }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : lazy ? "lazy" : "eager"}
          className="object-cover"
        />
      ) : null}
    </div>
  );
}
