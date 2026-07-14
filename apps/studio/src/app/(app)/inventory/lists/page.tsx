import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Inventory lists" };

export default async function InventoryListsPage() {
  const supabase = await getSupabase();
  const { data: lists } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, piece_list_items(count)")
    .order("name");

  async function addList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await db.from("piece_lists").insert({
      name,
      description: String(formData.get("description") ?? "").trim() || null,
    });
    revalidatePath("/inventory/lists");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/inventory" className="text-[12.5px] text-ink-soft">
          ← Inventory
        </Link>
      </div>

      <form action={addList} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          List name
          <input
            name="name"
            placeholder="Asian Art in London 2026"
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

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(lists ?? []).map((l) => (
          <li key={l.id} className="rounded-[11px] border border-line bg-cell p-4">
            <a href={`/inventory/lists/${l.id}`} className="block">
              <div className="flex items-center gap-2">
                <h2 className="text-[14.5px] font-semibold text-ink-strong hover:text-oranje">
                  {l.name}
                </h2>
                {l.is_dynamic ? (
                  <span className="rounded-full bg-oranje/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-oranje">
                    Live
                  </span>
                ) : null}
              </div>
              {l.description ? (
                <p className="mt-1 text-[12.5px] text-ink-muted">{l.description}</p>
              ) : null}
              <p className="mt-2 font-mono text-[11.5px] text-ink-soft">
                {l.is_dynamic
                  ? "Saved view · membership is live"
                  : `${(l.piece_list_items as unknown as { count: number }[])[0]?.count ?? 0} works`}
              </p>
            </a>
          </li>
        ))}
        {(lists ?? []).length === 0 ? (
          <li className="text-[13px] text-ink-muted">
            No lists yet — create one to group works (fair selections, viewing sets…).
          </li>
        ) : null}
      </ul>
    </div>
  );
}
