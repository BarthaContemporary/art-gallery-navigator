/**
 * The one rich-text block every website text field uses (event
 * introduction and "Read more", publication description, page body, About
 * statement). It offers only what the site's renderer
 * (src/components/portable-text.tsx) draws in the house style: sans
 * headings at three sizes, quotes, strong and emphasis (shown upright: no
 * italics anywhere), links, and bulleted and numbered lists. Sanity's
 * default toolbar also offered Heading 1, 5 and 6, code, underline and
 * strike-through, which the site flattened without warning.
 *
 * Takes effect in the hosted Studio only after `pnpm exec sanity deploy`
 * from apps/web. Text already stored keeps its old styles; the renderer
 * still draws those as the nearest supported style.
 *
 * Annotations are left out on purpose, so Sanity keeps its default link
 * (web, email, phone or relative address).
 */
export const richTextBlock = {
  type: "block",
  styles: [
    { title: "Normal", value: "normal" },
    { title: "Heading 2", value: "h2" },
    { title: "Heading 3", value: "h3" },
    { title: "Heading 4", value: "h4" },
    { title: "Quote", value: "blockquote" },
  ],
  lists: [
    { title: "Bulleted list", value: "bullet" },
    { title: "Numbered list", value: "number" },
  ],
  marks: {
    decorators: [
      { title: "Strong", value: "strong" },
      { title: "Emphasis", value: "em" },
    ],
  },
};
