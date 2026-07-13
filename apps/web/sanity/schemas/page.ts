/** Free-form editorial page (about, contact intro, terms, privacy, …). */
const page = {
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      description:
        'The website renders "about" and "contact" on their fixed routes; other slugs are available to link from navigation.',
    },
    {
      name: "body",
      title: "Body",
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
  ],
  preview: {
    select: { title: "title", subtitle: "slug.current" },
  },
};

export default page;
