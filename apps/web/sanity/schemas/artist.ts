/**
 * `artist` — READ-ONLY in the Studio. Synced one way from the inventory's
 * makers (studio app `/api/sync/sanity`), ids `artist-{makerId}`. The site's
 * Artists index and pages read from these; `work.artist` points at them.
 */
const artist = {
  name: "artist",
  title: "Artist",
  type: "document",
  readOnly: true,
  description: "Synced from the inventory database. Edit the maker there.",
  fields: [
    { name: "name", title: "Name (romaji)", type: "string" },
    {
      name: "nameNative",
      title: "Name (kanji / native script)",
      type: "string",
      description: "Shown in grey beside the romaji.",
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
    },
    { name: "lifeDates", title: "Life dates", type: "string", description: "e.g. 1914–96, or b. 1962" },
    { name: "country", title: "Country / region", type: "string" },
    { name: "period", title: "Period", type: "string", description: "e.g. Shōwa, Mingei, contemporary" },
    { name: "bioShort", title: "Biography — plain", type: "text", rows: 4 },
    { name: "bioLong", title: "Biography — literature and references", type: "text", rows: 8 },
    {
      name: "portrait",
      title: "Portrait (1:1)",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "caption", title: "Caption", type: "string" }],
    },
    { name: "hidden", title: "Hidden from the site", type: "boolean", initialValue: false },
    { name: "supabaseId", title: "Inventory maker id", type: "string" },
  ],
  preview: {
    select: { title: "name", subtitle: "lifeDates", media: "portrait" },
  },
};

export default artist;
