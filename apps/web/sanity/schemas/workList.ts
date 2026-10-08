/**
 * `workList` — READ-ONLY in the Studio. An inventory list (static or live),
 * pushed by the Supabase → Sanity sync as `list-{supabaseId}` with references
 * to its web-visible works. Events point at lists through `workLists`.
 */
const workList = {
  name: "workList",
  title: "Inventory list",
  type: "document",
  readOnly: true,
  description: "Synced from the inventory. Edit the list in the studio, not here.",
  fields: [
    { name: "name", title: "Name", type: "string" },
    { name: "description", title: "Description", type: "string" },
    { name: "isDynamic", title: "Live list (membership follows saved filters)", type: "boolean" },
    { name: "workCount", title: "Works on the website", type: "number" },
    {
      name: "works",
      title: "Works",
      type: "array",
      of: [{ type: "reference", to: [{ type: "work" }], weak: true }],
    },
    { name: "supabaseId", title: "Inventory list id", type: "string" },
    { name: "updatedAt", title: "Last changed in the inventory", type: "datetime" },
  ],
  preview: {
    select: { title: "name", count: "workCount", live: "isDynamic" },
    prepare: ({ title, count, live }: { title?: string; count?: number; live?: boolean }) => ({
      title: title ?? "List",
      subtitle: `${count ?? 0} work${count === 1 ? "" : "s"} on the website${live ? " · live" : ""}`,
    }),
  },
};

export default workList;
