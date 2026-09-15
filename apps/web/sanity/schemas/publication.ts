/**
 * `publication` — a catalogue, usually accompanying an exhibition
 * (e.g. "Showa", "Gutai", "East"). Cover image, description and an
 * optional external/PDF link.
 */
const publication = {
  name: "publication",
  title: "Publication",
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
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
    },
    {
      name: "description",
      title: "Description",
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
      name: "relatedExhibition",
      title: "Related exhibition",
      type: "reference",
      to: [{ type: "exhibition" }],
    },
    {
      name: "spreads",
      title: "Page spreads",
      type: "array",
      description: "Photographs of pages, shown as a gallery under the description.",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [{ name: "caption", title: "Caption", type: "string" }],
        },
      ],
    },
    {
      name: "publishedYear",
      title: "Published year",
      type: "number",
    },
    { name: "pages", title: "Pages", type: "number" },
    { name: "language", title: "Language", type: "string", initialValue: "English" },
    {
      name: "availability",
      title: "Availability",
      type: "string",
      initialValue: "available",
      options: { list: [
        { title: "Available", value: "available" },
        { title: "Out of print", value: "outOfPrint" },
      ], layout: "radio" },
    },
    {
      name: "pdf",
      title: "PDF",
      type: "file",
      options: { accept: "application/pdf" },
      description: "Offered as “Download PDF” on the page.",
    },
    {
      name: "format",
      title: "Format",
      type: "string",
      description: "e.g. 28 × 23 cm, softcover",
    },
    {
      name: "hidden",
      title: "Hidden from the site",
      type: "boolean",
      initialValue: false,
    },
    {
      name: "sortOrder",
      title: "Sort order",
      type: "number",
      description: "Ordering fallback when the year is missing (lower = more recent).",
    },
    {
      name: "legacyUrl",
      title: "Old site URL",
      type: "string",
      readOnly: true,
    },
    {
      name: "externalUrl",
      title: "External / PDF link",
      type: "url",
      description: "Optional link to a PDF or external catalogue page.",
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
    select: { title: "title", subtitle: "publishedYear", media: "coverImage" },
  },
};

export default publication;
