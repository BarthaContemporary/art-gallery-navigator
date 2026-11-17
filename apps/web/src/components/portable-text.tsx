import Image from "next/image";
import {
  imageDimensions,
  imageUrl,
  type PortableBlock,
  type SanityImage,
} from "@/lib/sanity";
import type { ReactNode } from "react";
import { ARTISTS_UNDER_CONSTRUCTION } from "@/lib/site";
import { nestLists, renderedStyle, type ListNode } from "@/lib/portable-lists";

/**
 * Minimal Portable Text renderer (no @portabletext/react dependency).
 * Voice register: serif body at 17/1.65 on a 640px measure; sans headings.
 * No italics anywhere — `em` is rendered upright.
 *
 * The Studio offers only what is drawn here (sanity/schemas/richText.ts).
 * Text stored before that keeps working: Heading 1 is drawn as Heading 2,
 * Heading 5 and 6 as Heading 4, a line break typed with Shift+Enter stays a
 * line break, nested list items nest; underline, strike-through and code
 * read as plain text.
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

/** Span text with its soft line breaks ("\n", Shift+Enter in the Studio) kept. */
function withBreaks(text: string): ReactNode {
  if (!text.includes("\n")) return text;
  const lines = text.split("\n");
  return lines.flatMap((line, i) => (i === 0 ? [line] : [<br key={`br${i}`} />, line]));
}

function renderSpan(span: Span, markDefs: MarkDef[], key: number): ReactNode {
  let node: ReactNode = withBreaks(span.text ?? "");
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
      if (def?._type === "link" && def.href && !(ARTISTS_UNDER_CONSTRUCTION && /^\/artists(\/|$)/.test(def.href))) {
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

  switch (renderedStyle(block.style)) {
    case "h2":
      return (
        <h2 className="t-section mt-10">
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
        <blockquote className="mt-6 max-w-[56ch] pl-6 font-sans text-lead font-light text-ink-70">
          {children}
        </blockquote>
      );
    default:
      return (
        <p className="mt-5 font-sans text-body text-ink-70 first:mt-0">{children}</p>
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

  /** One list and the lists nested in its items, by each item's level. */
  const renderList = (list: ListNode<TextBlock>, nested: boolean): ReactNode => {
    const items = list.items.map(({ block: item, children }) => (
      <li key={item._key} className="font-sans text-body text-ink-70">
        {(item.children ?? []).map((span, i) => renderSpan(span, item.markDefs ?? [], i))}
        {children.map((child) => renderList(child, true))}
      </li>
    ));
    const spacing = nested ? "mt-2" : "mt-5";
    const key = `list-${list.key}`;
    return list.type === "number" ? (
      <ol key={key} className={`${spacing} list-decimal space-y-2 pl-6`}>
        {items}
      </ol>
    ) : (
      <ul key={key} className={`${spacing} space-y-2 pl-6 ${nested ? "list-[circle]" : "list-disc"}`}>
        {items}
      </ul>
    );
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    for (const list of nestLists(listBuffer)) output.push(renderList(list, false));
    listBuffer = [];
  };

  for (const block of value) {
    if (block._type === "block") {
      const textBlock = block as TextBlock;
      if (textBlock.listItem) {
        // Every consecutive list item, whatever its type or level; nestLists sorts them out.
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
