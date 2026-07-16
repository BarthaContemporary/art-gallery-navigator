import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "List" };

const btnGhost =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

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
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const { data: memberRows } = await supabase
    .from("crm_list_members")
    .select("contact:crm_contacts ( id, first_name, last_name, email )")
    .eq("list_id", id);
  const members = (memberRows ?? [])
    .map((m) => (m as unknown as { contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null }).contact)
    .filter(Boolean) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
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
    if (!contactId) return;
    await db
      .from("crm_list_members")
      .upsert({ list_id: id, contact_id: contactId }, { onConflict: "list_id,contact_id", ignoreDuplicates: true });
    revalidatePath(`/crm/lists/${id}`);
  }

  async function removeMember(formData: FormData) {
    "use server";
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
    await db.from("crm_lists").delete().eq("id", id);
    redirect("/crm/lists");
  }

  const nameOf = (c: { first_name: string | null; last_name: string | null }) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";

  return (
    <div className="max-w-[820px]">
      <Link href="/crm/lists" className="text-[12.5px] text-ink-soft">
        ← All lists
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-strong">{list.name}</h1>
          {list.description ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{list.description}</p>
          ) : null}
        </div>
        <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
          {members.length} member{members.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
        <a href={`/api/export/labels.pdf?list=${id}`} className="font-medium text-primary">
          Labels PDF
        </a>
        <a href={`/api/export/contacts.vcf?list=${id}`} className="font-medium text-primary">
          vCards
        </a>
      </div>

      {/* Members */}
      <div className="mt-4 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[520px] bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Contact</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2 text-ink-body">
                  <Link href={`/crm/contacts/${m.id}`} className="hover:text-ink-strong">
                    {nameOf(m)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-muted">{m.email ?? "—"}</td>
                <td className="px-4 py-2 text-right">
                  <form action={removeMember}>
                    <input type="hidden" name="contact_id" value={m.id} />
                    <button type="submit" className="text-[12px] text-ink-soft hover:text-ink-strong">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                  No members yet — search below to add contacts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Add members */}
      <form method="get" className="mt-4 flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={term}
          placeholder="Search contacts by name or email…"
          className="w-72 rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
        />
        <button type="submit" className={btnGhost}>
          Search
        </button>
      </form>
      {term ? (
        <div className="mt-2 space-y-1">
          {results.map((c) => (
            <form
              key={c.id}
              action={addMember}
              className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
            >
              <input type="hidden" name="contact_id" value={c.id} />
              <span className="text-[13px] text-ink-body">
                {nameOf(c)}
                <span className="ml-2 text-[12px] text-ink-soft">{c.email ?? "no email"}</span>
              </span>
              <button type="submit" className={btnGhost}>
                Add
              </button>
            </form>
          ))}
          {results.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No matches (or already members).</p>
          ) : null}
        </div>
      ) : null}

      <form action={deleteList} className="mt-8">
        <button
          type="submit"
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink-strong"
        >
          Delete list
        </button>
      </form>
    </div>
  );
}
