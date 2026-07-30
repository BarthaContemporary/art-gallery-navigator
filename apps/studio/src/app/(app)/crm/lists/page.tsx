import { SaveToDriveLink } from "@/components/save-to-drive";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { LabelPdfButton } from "@/components/label-pdf-button";
import { countMembersForLists, isDynamic, describeRules } from "@/lib/crm-list-members";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";

export const metadata = { title: "Contact list" };

const AUTO = "Area of interest (auto)";

type ListRow = {
  id: string;
  name: string;
  description: string | null;
  is_dynamic: boolean | null;
  filter_rules: unknown;
};

export default async function ListsPage() {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("crm_lists")
    // Not crm_list_members(count): that embed reports 0 for every dynamic
    // list, since a dynamic list stores no rows.
    .select("id, name, description, is_dynamic, filter_rules, sort_order")
    // Hand-set order first, name only to break ties.
    .order("sort_order")
    .order("name");
  const lists = (data ?? []) as unknown as ListRow[];
  const counts = await countMembersForLists(supabase, lists);
  const custom = lists.filter((l) => l.description !== AUTO);
  // Areas of interest are not hand-ordered — there is no grip on these cards.
  // The busiest interest is the one worth reaching for first, so they sort by
  // membership, largest first, with an alphabetical tie-break so an equal count
  // never shuffles between renders.
  const auto = lists
    .filter((l) => l.description === AUTO)
    .sort(
      (a, b) =>
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name, "en"),
    );

  async function reorderLists(ids: string[]) {
    "use server";
    const db = await getSupabase();
    await persistOrder(db, "crm_lists", ids);
    revalidatePath("/crm/lists");
  }

  async function addList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await db.from("crm_lists").insert({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
    });
    revalidatePath("/crm/lists");
  }

  async function deleteList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const listId = String(formData.get("id") ?? "");
    if (!listId) return;
    // Never delete an auto area-of-interest list (it's managed automatically).
    const { data: linked } = await db
      .from("crm_interest_areas")
      .select("id")
      .eq("list_id", listId)
      .limit(1)
      .maybeSingle();
    if (linked) return;
    await db.from("crm_lists").delete().eq("id", listId);
    revalidatePath("/crm/lists");
  }

  const memberCount = (l: ListRow) => counts.get(l.id) ?? 0;

  return (
    <div>
      <form action={addList} className="flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Name
          <input
            name="name"
            placeholder="Japanese bronzes collectors"
            className="mt-1 block w-72 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]"
          />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Description
          <input
            name="description"
            className="mt-1 block w-80 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
        >
          Create list
        </button>
      </form>

      {/* Custom lists first */}
      {custom.length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-muted">No custom lists yet — create one above.</p>
      ) : (
      <ReorderGrid
        order={custom.map((l) => l.id)}
        onReorder={reorderLists}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        hint="Drag a grip to reorder these cards."
        showPosition={false}
        tiles={Object.fromEntries(
          custom.map((l) => [
            l.id,
            <div key={l.id} className="h-full rounded-[11px] border border-line bg-cell p-4 pl-9">
            <a href={`/crm/lists/${l.id}`} className="block">
              <h2 className="text-[14.5px] font-semibold text-ink-strong hover:text-oranje">
                {l.name}
              </h2>
              {l.description ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">{l.description}</p>
              ) : null}
              <p className="mt-2 font-mono text-[11.5px] text-ink-soft">
                {memberCount(l)} members
                {isDynamic(l) ? (
                  <span className="ml-1.5 font-sans normal-case text-ink-faint">
                    · live ({describeRules(l)})
                  </span>
                ) : null}
              </p>
            </a>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a href={`/crm/lists/${l.id}`} className="text-[12px] font-medium text-primary">
                Manage
              </a>
              <LabelPdfButton listId={l.id} />
              <SaveToDriveLink href={`/api/export/contacts.vcf?list=${l.id}`} className="text-[12px] font-medium text-primary">
                vCards
              </SaveToDriveLink>
              <DeleteListButton action={deleteList} id={l.id} name={l.name} />
            </div>
            </div>,
          ]),
        )}
      />
      )}

      {/* Areas of interest (auto) — tinted, not deletable */}
      {auto.length ? (
        <>
          <h2 className="mt-8 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Areas of interest — auto-updated
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {auto.map((l) => (
              <li
                key={l.id}
                className="rounded-[11px] border border-oranje/25 bg-oranje/5 p-4"
              >
                <a href={`/crm/lists/${l.id}`} className="block">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14.5px] font-semibold text-ink-strong hover:text-oranje">
                      {l.name}
                    </h2>
                    <span className="rounded-full bg-oranje/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-oranje">
                      Interest
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11.5px] text-ink-soft">
                    {memberCount(l)} members · auto-updated
                  </p>
                </a>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a href={`/crm/lists/${l.id}`} className="text-[12px] font-medium text-primary">
                    View
                  </a>
                  {/* Same Avery prompt as the custom cards — a plain link would
                      silently pick a layout for the user. */}
                  <LabelPdfButton listId={l.id} />
                  <SaveToDriveLink href={`/api/export/contacts.vcf?list=${l.id}`} className="text-[12px] font-medium text-primary">
                    vCards
                  </SaveToDriveLink>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
