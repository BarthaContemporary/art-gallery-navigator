/**
 * `catalogueEntry` — a work as it appeared in a past exhibition, owned by the
 * CMS. These come from the old Squarespace site (one gallery slide per work)
 * and from future exhibitions of consigned or sold pieces that never touch
 * the inventory. They are deliberately NOT references to the synced `work`
 * type: the inventory exports to the website, the website never feeds back.
 */
const catalogueEntry = {
  name: "catalogueEntry",
  title: "Catalogue entry",
  type: "object",
  fields: [
    {
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
    },
    {
      name: "reference",
      title: "Reference",
      type: "string",
      description: "The exhibition's own code for the work (e.g. SHO02, T26-01).",
    },
    { name: "title", title: "Title", type: "string" },
    { name: "maker", title: "Maker", type: "string" },
    {
      name: "makerDates",
      title: "Maker dates",
      type: "string",
      description: "e.g. 1914–96",
    },
    { name: "medium", title: "Medium", type: "string" },
    {
      name: "originAndDate",
      title: "Origin and date",
      type: "string",
      description: "e.g. Rajasthan, India, 19th century",
    },
    { name: "dimensions", title: "Dimensions", type: "string" },
    { name: "sold", title: "Sold", type: "boolean", initialValue: false },
    {
      name: "rawCaption",
      title: "Original caption",
      type: "text",
      rows: 2,
      description:
        "The caption exactly as it was on the old site. Kept so nothing is lost if the split into fields went wrong.",
    },
  ],
  preview: {
    select: { title: "title", subtitle: "reference", media: "image" },
  },
};

export default catalogueEntry;
