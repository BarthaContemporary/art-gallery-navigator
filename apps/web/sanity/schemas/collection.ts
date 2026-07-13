/** Curated grouping of works (e.g. "Meiji bronzes", "Indian miniatures"). */
const collection = {
  name: "collection",
  title: "Collection",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    },
    { name: "description", title: "Description", type: "text", rows: 4 },
    {
      name: "cover",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
    },
    {
      name: "works",
      title: "Works",
      type: "array",
      of: [{ type: "reference", to: [{ type: "work" }] }],
    },
  ],
  preview: {
    select: { title: "title", media: "cover" },
  },
};

export default collection;
