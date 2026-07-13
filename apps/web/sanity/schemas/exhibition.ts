/**
 * `exhibition` — a gallery show or art-fair presentation. The core of the
 * public site. Editors curate synced `work` documents into each exhibition.
 */
const exhibition = {
  name: "exhibition",
  title: "Exhibition",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    },
    {
      name: "subtitle",
      title: "Subtitle",
      type: "string",
      description: "Optional strapline shown under the title.",
    },
    {
      name: "venue",
      title: "Venue",
      type: "string",
      description: "Where the show takes place (e.g. the gallery, or a fair hall).",
    },
    { name: "startDate", title: "Start date", type: "date" },
    { name: "endDate", title: "End date", type: "date" },
    {
      name: "isArtFair",
      title: "Art-fair presentation",
      type: "boolean",
      initialValue: false,
      description: "Tick if this is a fair booth rather than a gallery show.",
    },
    {
      name: "fairName",
      title: "Fair name",
      type: "string",
      description: "e.g. TEFAF Maastricht 2026. Shown when this is a fair presentation.",
      hidden: ({ parent }: { parent?: { isArtFair?: boolean } }) =>
        !parent?.isArtFair,
    },
    {
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
    },
    {
      name: "intro",
      title: "Introduction",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [{ name: "caption", title: "Caption", type: "string" }],
        },
      ],
    },
    {
      name: "works",
      title: "Works shown",
      type: "array",
      of: [{ type: "reference", to: [{ type: "work" }] }],
    },
    {
      name: "seo",
      title: "SEO",
      type: "object",
      fields: [
        { name: "title", title: "Meta title", type: "string" },
        { name: "description", title: "Meta description", type: "text", rows: 2 },
        { name: "ogImage", title: "Share image", type: "image" },
      ],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "venue", media: "coverImage" },
  },
};

export default exhibition;
