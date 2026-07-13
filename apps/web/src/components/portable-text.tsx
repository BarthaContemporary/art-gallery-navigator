import Image from "next/image";
import {
  imageDimensions,
  imageUrl,
  type PortableBlock,
  type SanityImage,
} from "@/lib/sanity";
import type { ReactNode } from "react";

/**
 * Minimal Portable Text renderer (no @portabletext/react dependency).
 * Voice register: serif body at 17/1.65 on a 640px measure; sans headings.
 * No italics anywhere — `em` is rendered upright.
 */

interface Span {
  _type: "span";
  _key?: string;
  text?: string;
  marks?: string[];
}

interface MarkDef {
  _key: string;
  _type: string;
  href?: string;
}

interface TextBlock extends PortableBlock {
  style?: string;
  listItem?: string;
  level?: number;
  children?: Span[];
  markDefs?: MarkDef[];
}

function renderSpan(span: Span, markDefs: MarkDef[], key: number): ReactNode {
  let node: ReactNode = span.text ?? "";
  for (const mark of span.marks ?? []) {
    if (mark === "strong") {
      node = (
        <strong key={key} className="font-medium text-sumi">
          {node}
        </strong>
      );
    } else if (mark === "em") {
      // No italics — emphasise upright.
      node = (
        <em key={key} className="not-italic text-sumi">
          {node}
        </em>
      );
    } else {
      const def = markDefs.find((d) => d._key === mark);
      if (def?._type === "link" && def.href) {
        node = (
          <a
            key={key}
            href={def.href}
            className="link-inline"
            rel="noopener noreferrer"
          >
            {node}
          </a>
        );
      }
    }
  }
  return <span key={key}>{node}</span>;
}

function BlockContent({ block }: { block: TextBlock }) {
  const children = (block.children ?? []).map((span, i) =>
    renderSpan(span, block.markDefs ?? [], i),
  );

  switch (block.style) {
    case "h2":
      return (
        <h2 className="mt-16 font-sans text-h2 font-medium tracking-tight text-sumi">
          {children}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-10 font-sans text-lead font-medium text-sumi">
          {children}
        </h3>
      );
    case "h4":
      return (
        <h4 className="mt-8 font-sans text-ui font-medium uppercase tracking-[0.08em] text-ink-50">
          {children}
        </h4>
      );
    case "blockquote":
      return (
        <blockquote className="mt-6 border-l border-sumi pl-6 font-serif text-lead font-light text-ink-70">
          {children}
        </blockquote>
      );
    default:
      return (
        <p className="mt-5 font-serif text-body text-ink-70">{children}</p>
      );
  }
}

function ImageBlock({ block }: { block: PortableBlock }) {
  const image = block as unknown as SanityImage;
  const src = imageUrl(image, { width: 1600 });
  const dims = imageDimensions(image);
  if (!src || !dims) return null;
  return (
    <figure className="mt-10">
      <Image
        src={src}
        alt={image.caption ?? ""}
        width={dims.width}
        height={dims.height}
        sizes="(min-width: 768px) 42rem, 100vw"
        className="w-full bg-washi-2"
      />
      {image.caption ? (
        <figcaption className="label mt-3">{image.caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function PortableText({
  value,
}: {
  value: PortableBlock[] | null | undefined;
}) {
  if (!value || value.length === 0) return null;

  const output: ReactNode[] = [];
  let listBuffer: TextBlock[] = [];
  let listType: string | null = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer.map((item) => (
      <li key={item._key} className="font-serif text-body text-ink-70">
        {(item.children ?? []).map((span, i) =>
          renderSpan(span, item.markDefs ?? [], i),
        )}
      </li>
    ));
    const key = `list-${listBuffer[0]?._key ?? output.length}`;
    output.push(
      listType === "number" ? (
        <ol key={key} className="mt-5 list-decimal space-y-2 pl-6">
          {items}
        </ol>
      ) : (
        <ul key={key} className="mt-5 list-disc space-y-2 pl-6">
          {items}
        </ul>
      ),
    );
    listBuffer = [];
    listType = null;
  };

  for (const block of value) {
    if (block._type === "block") {
      const textBlock = block as TextBlock;
      if (textBlock.listItem) {
        if (listType && listType !== textBlock.listItem) flushList();
        listType = textBlock.listItem;
        listBuffer.push(textBlock);
        continue;
      }
      flushList();
      output.push(<BlockContent key={block._key} block={textBlock} />);
    } else if (block._type === "image") {
      flushList();
      output.push(<ImageBlock key={block._key} block={block} />);
    }
  }
  flushList();

  return <div className="max-w-[var(--measure)]">{output}</div>;
}
