/** Singleton — gallery identity, contact details and SEO defaults. */
const siteSettings = {
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    { name: "galleryName", title: "Gallery name", type: "string" },
    { name: "tagline", title: "Tagline", type: "string" },
    {
      name: "aboutTeaser",
      title: "About teaser",
      type: "text",
      rows: 3,
      description: "Short paragraph shown on the home page.",
    },
    { name: "address", title: "Address", type: "text", rows: 3 },
    { name: "email", title: "Email", type: "string" },
    { name: "phone", title: "Phone", type: "string" },
    { name: "openingHours", title: "Opening hours", type: "string" },
    {
      name: "socials",
      title: "Social links",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", title: "Label", type: "string" },
            { name: "url", title: "URL", type: "url" },
          ],
        },
      ],
    },
    {
      name: "defaultSeo",
      title: "Default SEO",
      type: "object",
      fields: [
        { name: "title", title: "Default title", type: "string" },
        { name: "description", title: "Default description", type: "text", rows: 3 },
        { name: "ogImage", title: "Default share image", type: "image" },
      ],
    },
    {
      name: "featuredWorks",
      title: "Featured works (home page)",
      type: "array",
      of: [{ type: "reference", to: [{ type: "work" }] }],
    },
    {
      name: "facebookPixelId",
      title: "Meta (Facebook) pixel ID",
      type: "string",
      description:
        "Paste the numeric pixel ID from Meta Events Manager and publish — the pixel goes live on the next page load. Leave empty to run no pixel at all. It only ever loads for visitors who accept marketing cookies; it is listed by name in the Cookie Policy, so if you change or remove it, update that page too.",
      validation: (Rule: { regex: (r: RegExp, o: { name: string }) => unknown }) =>
        Rule.regex(/^\d{10,20}$/, { name: "numeric pixel ID" }),
    },
  ],
  preview: {
    select: { title: "galleryName" },
    prepare(selection: { title?: string }) {
      return { title: selection.title ?? "Site settings" };
    },
  },
};

export default siteSettings;
