import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Mailing lists" };

export default async function ListsPage() {
  const supabase = await getSupabase();
  const { data: lists } = await supabase
    .from("crm_lists")
    .select("id, name, description, crm_list_members(count)")
    .order("name");

  async function addList(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await supabase.from("crm_lists").insert({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
    });
    revalidatePath("/crm/lists");
  }

  return (
    <div>
      <form action={addList} className="flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Name
          <input name="name" placeholder="Japanese bronzes collectors" className="mt-1 block w-72 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Description
          <input name="description" className="mt-1 block w-80 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
          Create list
        </button>
      </form>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(lists ?? []).map((l) => (
          <li key={l.id} className="rounded-[11px] border border-line bg-cell p-4">
            <h2 className="text-[14.5px] font-semibold text-ink-strong">{l.name}</h2>
            {l.description ? <p className="mt-1 text-[12.5px] text-ink-muted">{l.description}</p> : null}
            <p className="mt-2 font-mono text-[11.5px] text-ink-soft">
              {(l.crm_list_members as unknown as { count: number }[])[0]?.count ?? 0} members
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a href={`/api/export/labels.pdf?list=${l.id}`} className="text-[12px] font-medium text-primary">
                Labels PDF
              </a>
              <a href={`/api/export/contacts.vcf?list=${l.id}`} className="text-[12px] font-medium text-primary">
                vCards
              </a>
            </div>
          </li>
        ))}
        {(lists ?? []).length === 0 ? (
          <li className="text-[13px] text-ink-muted">No lists yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
