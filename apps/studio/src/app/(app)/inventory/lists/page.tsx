import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Inventory lists" };

export default async function InventoryListsPage() {
  const supabase = await getSupabase();
  const { data: lists } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, filter_rules, piece_list_items(count)")
    .order("name");

  // Live lists keep no rows in piece_list_items — membership is the saved
  // filters, re-run on read — so their real size has to be computed, not
  // counted from the join table.
  const counts = new Map<string, number>();
  await Promise.all(
    ((lists ?? []) as unknown as {
      id: string;
      is_dynamic: boolean | null;
      filter_rules: { q?: string | null; status?: string | null; category?: string | null; location?: string | null } | null;
      piece_list_items: { count: number }[];
    }[]).map(async (l) => {
      if (!l.is_dynamic) {
        counts.set(l.id, l.piece_list_items?.[0]?.count ?? 0);
        return;
      }
      const rules = l.filter_rules ?? {};
      const q = (rules.q ?? "").trim();
      if (q) {
        const { data: hits } = await supabase.rpc("pieces_search", { q });
        let f = (hits ?? []) as Array<{ id: string; status: string; category_id: string | null; location_id: string | null }>;
        if (rules.status) f = f.filter((h) => h.status === rules.status);
        if (rules.category) f = f.filter((h) => h.category_id === rules.category);
        if (rules.location) f = f.filter((h) => h.location_id === rules.location);
        counts.set(l.id, f.length);
        return;
      }
      let cq = supabase.from("vw_pieces_list").select("id", { count: "exact", head: true });
      if (rules.status) cq = cq.eq("status", rules.status);
      if (rules.category) cq = cq.eq("category_id", rules.category);
      if (rules.location) cq = cq.eq("location_id", rules.location);
      const { count } = await cq;
      counts.set(l.id, count ?? 0);
    }),
  );

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
                {counts.get(l.id) ?? 0} work{(counts.get(l.id) ?? 0) === 1 ? "" : "s"}
                {l.is_dynamic ? " · saved view, membership is live" : ""}
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
