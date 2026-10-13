import { SaveToDriveLink } from "@/components/save-to-drive";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { LabelPdfButton } from "@/components/label-pdf-button";
import { loadListContacts, isDynamic, describeRules } from "@/lib/crm-list-members";
import { ConfirmDelete } from "./confirm-delete";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";

export const metadata = { title: "List" };

/** The description the lists index uses to tell the auto interest lists apart. */
const AUTO = "Area of interest (auto)";

/**
 * An area-of-interest list is kept by the system: deleting it would unlink its
 * interest area (crm_interest_areas.list_id is set null). The index page
 * offers no Delete for these and its action refuses them; so does this page.
 * Module scope, not a closure, so the server action below can call it.
 */
async function isInterestList(
  db: Awaited<ReturnType<typeof getSupabase>>,
  listId: string,
): Promise<boolean> {
  const { data } = await db
    .from("crm_interest_areas")
    .select("id")
    .eq("list_id", listId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export default async function ListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const supabase = await getSupabase();

  const { data: list } = await supabase
    .from("crm_lists")
    .select("id, name, description, is_dynamic, filter_rules")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const autoList = list.description === AUTO || (await isInterestList(supabase, id));

  const dynamic = isDynamic(list);
  const members = await loadListContacts<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>(supabase, list, "id, first_name, last_name, email");
  const memberIds = new Set(members.map((m) => m.id));

  const term = (q ?? "").trim();
  let results: typeof members = [];
  if (term) {
    // Trigram-fuzzy contact search.
    const { data } = await supabase
      .rpc("crm_contacts_search", { q: term })
      .select("id, first_name, last_name, email")
      .limit(20);
    results = ((data ?? []) as unknown as typeof members).filter((c) => !memberIds.has(c.id));
  }

  async function addMember(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const contactId = String(formData.get("contact_id") ?? "");
    if (!contactId || dynamic) return;
    await db
      .from("crm_list_members")
      .upsert({ list_id: id, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
    revalidatePath(`/crm/lists/${id}`);
  }

  async function removeMember(formData: FormData) {
    "use server";
    if (dynamic) return;
    const db = await getSupabase();
    await db
      .from("crm_list_members")
      .delete()
      .eq("list_id", id)
      .eq("contact_id", String(formData.get("contact_id") ?? ""));
    revalidatePath(`/crm/lists/${id}`);
  }

  async function deleteList() {
    "use server";
    const db = await getSupabase();
    // Checked again here, not only by hiding the button: the same guard as
    // the index page's action.
    if (await isInterestList(db, id)) return;
    await db.from("crm_lists").delete().eq("id", id);
    redirect("/crm/lists");
  }

  const nameOf = (c: { first_name: string | null; last_name: string | null }) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
  const n = members.length;

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/crm/lists", label: "All lists" }}
        title={list.name}
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {dynamic ? <Badge tone="info">Live</Badge> : autoList ? <Badge>Interest</Badge> : null}
            <span className="tabular">
              {formatCount(n)} member{n === 1 ? "" : "s"}
            </span>
          </span>
        }
        actions={
          <>
            <LabelPdfButton listId={id} align="right" />
            <SaveToDriveLink href={`/api/export/contacts.vcf?list=${id}`} className={buttonClass({ size: "sm" })}>
              vCards
            </SaveToDriveLink>
          </>
        }
      >
        {list.description ? (
          <p className="max-w-[var(--jvb-measure)] text-[13px] leading-[1.45] text-body">{list.description}</p>
        ) : null}
      </PageHeader>

      <div className="space-y-6">
        <Section title="Members">
          <TableFrame>
            <Table className="min-w-[520px]">
              <thead>
                <tr>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  {dynamic ? null : (
                    <Th className="w-24">
                      <span className="sr-only">Actions</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <Tr key={m.id}>
                    <Td>
                      <Link href={`/crm/contacts/${m.id}`} className="link-plain font-medium text-ink">
                        {nameOf(m)}
                      </Link>
                    </Td>
                    <Td className="text-body">{m.email ?? "—"}</Td>
                    {/* Membership is computed on a dynamic list, so there is
                        nothing to remove: change the rules instead. */}
                    {dynamic ? null : (
                      <Td className="py-0 text-right">
                        <form action={removeMember}>
                          <input type="hidden" name="contact_id" value={m.id} />
                          <Button
                            type="submit"
                            variant="quiet"
                            size="sm"
                            pendingLabel="Removing…"
                            aria-label={`Remove ${nameOf(m)} from this list`}
                          >
                            Remove
                          </Button>
                        </form>
                      </Td>
                    )}
                  </Tr>
                ))}
                {n === 0 ? (
                  <EmptyRow colSpan={dynamic ? 2 : 3}>
                    {dynamic
                      ? "No contacts match this list’s rules."
                      : "No members yet. Search above to add contacts."}
                  </EmptyRow>
                ) : null}
              </tbody>
            </Table>
          </TableFrame>
        </Section>

        {/* Add members: curated lists only. */}
        {dynamic ? (
          <Notice tone="info">
            This is a live list: it holds <strong className="font-semibold text-ink">{describeRules(list)}</strong> and
            updates itself as contacts are added, changed or removed. There is nothing to add or remove by hand.
          </Notice>
        ) : (
          <Section title="Add members">
            <form method="get" role="search" className="flex flex-wrap items-end gap-2">
              <div className="flex w-full min-w-0 max-w-md flex-col gap-1">
                <label htmlFor="list-member-search" className="label">
                  Find contacts to add
                </label>
                <input
                  id="list-member-search"
                  type="search"
                  name="q"
                  defaultValue={term}
                  placeholder="Name or email"
                  className="field"
                />
              </div>
              <Button type="submit" icon={<SearchIcon size={14} />}>
                Search
              </Button>
            </form>
            {term ? (
              results.length > 0 ? (
                <ul className="mt-3 border-t border-rule">
                  {results.map((c) => (
                    <li key={c.id} className="border-b border-rule">
                      <form action={addMember} className="flex items-center justify-between gap-3 py-2">
                        <input type="hidden" name="contact_id" value={c.id} />
                        <span className="min-w-0 text-[13px] leading-[1.45] text-ink">
                          {nameOf(c)}
                          <span className="ml-2 text-[12px] text-meta">{c.email ?? "no email"}</span>
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          pendingLabel="Adding…"
                          icon={<PlusIcon size={14} />}
                          aria-label={`Add ${nameOf(c)}`}
                        >
                          Add
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[13px] leading-[1.45] text-body">
                  No contacts match “{term}” who are not already on the list.
                </p>
              )
            ) : null}
          </Section>
        )}

        {autoList ? null : (
          <Section title="Delete list">
            <form action={deleteList}>
              <ConfirmDelete name={list.name} />
            </form>
          </Section>
        )}
      </div>
    </div>
  );
}
