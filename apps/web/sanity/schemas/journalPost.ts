const journalPost = {
  name: "journalPost",
  title: "Journal post",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    },
    { name: "publishedAt", title: "Published at", type: "datetime" },
    { name: "excerpt", title: "Excerpt", type: "text", rows: 3 },
    {
      name: "cover",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
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
    select: { title: "title", subtitle: "publishedAt", media: "cover" },
  },
};

export default journalPost;
