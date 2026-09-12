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
      title: "Works shown (from the inventory)",
      type: "array",
      description:
        "Current stock, synced from the inventory. For past exhibitions use the catalogue below.",
      of: [{ type: "reference", to: [{ type: "work" }] }],
    },
    {
      name: "catalogue",
      title: "Catalogue",
      type: "array",
      description:
        "Works as they appeared in the exhibition — owned by the website, independent of the inventory. Migrated from the old site; edit freely.",
      of: [{ type: "catalogueEntry" }],
    },
    {
      name: "hidden",
      title: "Hidden from the site",
      type: "boolean",
      initialValue: false,
      description: "Keep the record but don't list or serve the page.",
    },
    {
      name: "sortOrder",
      title: "Sort order",
      type: "number",
      description:
        "Ordering fallback for exhibitions without dates (lower = more recent). Dates win once entered.",
    },
    {
      name: "legacyUrl",
      title: "Old site URL",
      type: "string",
      readOnly: true,
      description: "Path on the Squarespace site this was migrated from; drives the redirect.",
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
