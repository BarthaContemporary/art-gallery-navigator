import { richTextBlock } from "./richText";

/**
 * Editorial page. Only the page with the slug "about" is read by the site:
 * its title and body stand in on the About page while Site settings has no
 * About headline and statement. Other slugs have no route.
 */
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
        'Only "about" is used: its title and body fill the About page until Site settings has an About headline and statement. Pages with other slugs are not shown on the website.',
    },
    {
      name: "body",
      title: "Body",
      type: "array",
      of: [
        richTextBlock,
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
