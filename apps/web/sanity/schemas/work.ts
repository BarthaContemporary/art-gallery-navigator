/**
 * `work` — READ-ONLY in the Studio. Documents are created/updated/deleted by
 * the Supabase → Sanity sync (studio app `/api/sync/sanity`, outbox-driven)
 * with deterministic ids `work-{supabaseId}`. Editors curate works into
 * collections/exhibitions but never edit the works themselves.
 */
const work = {
  name: "work",
  title: "Work",
  type: "document",
  readOnly: true,
  description: "Synced from the inventory database. Do not edit by hand.",
  fields: [
    { name: "stockNumber", title: "Stock number", type: "string" },
    { name: "title", title: "Title", type: "string" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
    },
    { name: "maker", title: "Maker", type: "string" },
    { name: "makerLifeDates", title: "Maker life dates", type: "string" },
    { name: "period", title: "Period", type: "string" },
    { name: "originRegion", title: "Origin / region", type: "string" },
    { name: "medium", title: "Medium", type: "string" },
    { name: "dimensionsDisplay", title: "Dimensions", type: "string" },
    { name: "description", title: "Description", type: "text", rows: 8 },
    {
      name: "category",
      title: "Category",
      type: "string",
      description: "Display name of the inventory category.",
    },
    {
      name: "categorySlug",
      title: "Category slug",
      type: "string",
      description: "Used by the /works category filter.",
    },
    {
      name: "images",
      title: "Images",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            { name: "caption", title: "Caption", type: "string" },
            {
              name: "role",
              title: "Role",
              type: "string",
              options: {
                list: [
                  "front",
                  "back",
                  "side",
                  "signature",
                  "box",
                  "detail",
                  "condition",
                ],
              },
            },
          ],
        },
      ],
    },
    {
      name: "priceDisplay",
      title: "Price display",
      type: "string",
      initialValue: "POA",
      description: "Public price string; defaults to POA.",
    },
    { name: "available", title: "Available", type: "boolean", initialValue: true },
    {
      name: "supabaseId",
      title: "Supabase piece id",
      type: "string",
      description: "UUID of the source row in pieces.",
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "stockNumber",
      media: "images.0",
    },
  },
};

export default work;
