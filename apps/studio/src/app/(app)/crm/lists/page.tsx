import Link from "next/link";
import { SaveToDriveLink } from "@/components/save-to-drive";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { LabelPdfButton } from "@/components/label-pdf-button";
import { countMembersForLists, isDynamic, describeRules } from "@/lib/crm-list-members";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Contact lists" };

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
  const members = (n: number) => `${formatCount(n)} ${n === 1 ? "member" : "members"}`;
  // The small outputs every card carries: mailing labels and vCards.
  const outputs = (l: ListRow) => (
    <>
      {/* Same Avery prompt everywhere: a plain link would silently pick a
          layout for the user. */}
      <LabelPdfButton listId={l.id} className={buttonClass({ variant: "quiet", size: "sm" })} />
      <SaveToDriveLink
        href={`/api/export/contacts.vcf?list=${l.id}`}
        className={buttonClass({ variant: "quiet", size: "sm" })}
      >
        vCards
      </SaveToDriveLink>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Contact lists"
        meta={<span className="tabular">{`${formatCount(lists.length)} ${lists.length === 1 ? "list" : "lists"}`}</span>}
      />

      <div className="space-y-6">
        <Section title="New list" meta="A hand-picked group of contacts, for a newsletter, an offer or a mailing.">
          <form action={addList} className="flex flex-wrap items-end gap-2">
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
              <label htmlFor="new-contact-list-name" className="label">
                Name
              </label>
              <input
                id="new-contact-list-name"
                name="name"
                placeholder="Japanese bronzes collectors"
                className="field"
              />
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-80">
              <label htmlFor="new-contact-list-description" className="label">
                Description <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input id="new-contact-list-description" name="description" className="field" />
            </div>
            <Button type="submit" variant="primary" pendingLabel="Creating…">
              Create list
            </Button>
          </form>
        </Section>

        {/* Custom lists first */}
        <Section title="Your lists">
          {custom.length === 0 ? (
            <EmptyState>No lists of your own yet. Create one above.</EmptyState>
          ) : (
            <ReorderGrid
              order={custom.map((l) => l.id)}
              onReorder={reorderLists}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              hint="Drag a grip, or focus it and press the arrow keys, to reorder these cards."
              showPosition={false}
              tiles={Object.fromEntries(
                custom.map((l) => [
                  l.id,
                  <div key={l.id} className="h-full border border-rule p-4 pl-11">
                    <Link href={`/crm/lists/${l.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14.5px] font-semibold leading-[1.45] text-ink group-hover:underline group-hover:underline-offset-2">
                          {l.name}
                        </h3>
                        {isDynamic(l) ? <Badge tone="info">Live</Badge> : null}
                      </div>
                      {l.description ? (
                        <p className="mt-1 text-[13px] leading-[1.45] text-body">{l.description}</p>
                      ) : null}
                      <p className="mt-2 text-[12px] leading-[1.4] text-meta">
                        <span className="tabular">{members(memberCount(l))}</span>
                        {isDynamic(l) ? `, ${describeRules(l)}` : null}
                      </p>
                    </Link>
                    <div className="-ml-1.5 mt-3 flex flex-wrap items-center gap-1">
                      <ButtonLink href={`/crm/lists/${l.id}`} variant="quiet" size="sm">
                        Manage
                      </ButtonLink>
                      {outputs(l)}
                      <DeleteListButton action={deleteList} id={l.id} name={l.name} />
                    </div>
                  </div>,
                ]),
              )}
            />
          )}
        </Section>

        {/* Areas of interest: kept by the system, so no grip and no Delete. */}
        {auto.length ? (
          <Section
            title="Areas of interest"
            meta="Updated automatically from the areas of interest on each contact. They cannot be deleted here."
          >
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {auto.map((l) => (
                <li key={l.id} className="border border-rule p-4">
                  <Link href={`/crm/lists/${l.id}`} className="group block">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-semibold leading-[1.45] text-ink group-hover:underline group-hover:underline-offset-2">
                        {l.name}
                      </h3>
                      <Badge>Interest</Badge>
                    </div>
                    <p className="mt-2 text-[12px] leading-[1.4] text-meta">
                      <span className="tabular">{members(memberCount(l))}</span>, updated automatically
                    </p>
                  </Link>
                  <div className="-ml-1.5 mt-3 flex flex-wrap items-center gap-1">
                    <ButtonLink href={`/crm/lists/${l.id}`} variant="quiet" size="sm">
                      View
                    </ButtonLink>
                    {outputs(l)}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
