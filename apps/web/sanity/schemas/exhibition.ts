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
      name: "datePrecision",
      title: "Show dates as",
      type: "string",
      initialValue: "day",
      options: {
        list: [
          { title: "Exact dates (3 March – 12 April 2026)", value: "day" },
          { title: "Month and year (March – April 2026)", value: "month" },
        ],
        layout: "radio",
      },
      description: "With month and year, pick any day in the month above; only the month is shown.",
    },
    {
      name: "privateViews",
      title: "Private views and openings",
      type: "array",
      description: "Listed under the dates, e.g. a private view by invitation. Each has its own time.",
      of: [
        {
          type: "object",
          name: "privateView",
          fields: [
            { name: "label", title: "Label", type: "string", initialValue: "Private view" },
            { name: "start", title: "Start", type: "datetime", options: { timeStep: 15 } },
            { name: "end", title: "End", type: "datetime", options: { timeStep: 15 } },
            {
              name: "access",
              title: "Access",
              type: "string",
              initialValue: "invitation",
              options: {
                list: [
                  { title: "By invitation only", value: "invitation" },
                  { title: "RSVP", value: "rsvp" },
                  { title: "Open to all", value: "open" },
                ],
                layout: "radio",
              },
            },
            { name: "note", title: "Note", type: "string", description: "Optional, e.g. the address if different." },
          ],
          preview: {
            select: { title: "label", subtitle: "start" },
          },
        },
      ],
    },
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
      name: "stand",
      title: "Stand / booth",
      type: "string",
      description: "e.g. Stand 262 — shown for fairs.",
      hidden: ({ parent }: { parent?: { isArtFair?: boolean } }) => !parent?.isArtFair,
    },
    {
      name: "heroImages",
      title: "Slideshow images (16:9)",
      type: "array",
      description: "Top-of-page slideshow. Falls back to the cover image when empty.",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [{ name: "caption", title: "Caption", type: "string" }],
        },
      ],
    },
    {
      name: "longText",
      title: "Read more (longer curatorial text)",
      type: "array",
      description: "Revealed inline by “Read more”. The Introduction above stays the plain-language opener.",
      of: [{ type: "block" }],
    },
    {
      name: "pdf",
      title: "Catalogue PDF",
      type: "file",
      options: { accept: "application/pdf" },
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
