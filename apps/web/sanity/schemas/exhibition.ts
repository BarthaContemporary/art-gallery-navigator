const exhibition = {
  name: "exhibition",
  title: "Exhibition",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "string" },
    { name: "venue", title: "Venue", type: "string" },
    { name: "startDate", title: "Start date", type: "date" },
    { name: "endDate", title: "End date", type: "date" },
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
    {
      name: "works",
      title: "Works shown",
      type: "array",
      of: [{ type: "reference", to: [{ type: "work" }] }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "venue" },
  },
};

export default exhibition;
