import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Inventory list" };

const btnGhost =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

type PieceLite = {
  id: string;
  stock_number: string | null;
  title: string | null;
  medium: string | null;
  period: string | null;
};

export default async function InventoryListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();

  const { data: list } = await supabase
    .from("piece_lists")
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const { data: itemRows } = await supabase
    .from("piece_list_items")
    .select("sort_order, piece:pieces ( id, stock_number, title, medium, period )")
    .eq("list_id", id)
    .order("sort_order", { nullsFirst: true });
  const items = (itemRows ?? [])
    .map((r) => (r as unknown as { piece: PieceLite | null }).piece)
    .filter(Boolean) as PieceLite[];
  const existing = new Set(items.map((p) => p.id));

  const addQ = (sp.add ?? "").trim();
  let results: PieceLite[] = [];
  if (addQ) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    results = ((hits ?? []) as PieceLite[]).filter((p) => !existing.has(p.id)).slice(0, 20);
  }

  async function addItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    const { data: mx } = await db
      .from("piece_list_items")
      .select("sort_order")
      .eq("list_id", id)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    await db.from("piece_list_items").upsert(
      { list_id: id, piece_id: pieceId, sort_order: (mx?.sort_order ?? -1) + 1 },
      { onConflict: "list_id,piece_id", ignoreDuplicates: true },
    );
    revalidatePath(`/inventory/lists/${id}`);
  }

  async function removeItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("piece_list_items")
      .delete()
      .eq("list_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""));
    revalidatePath(`/inventory/lists/${id}`);
  }

  async function deleteList() {
    "use server";
    const db = await getSupabase();
    await db.from("piece_lists").delete().eq("id", id);
    redirect("/inventory/lists");
  }

  return (
    <div className="max-w-[860px]">
      <Link href="/inventory/lists" className="text-[12.5px] text-ink-soft">
        ← All inventory lists
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-ink-strong">{list.name}</h1>
          {list.description ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{list.description}</p>
          ) : null}
        </div>
        <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
          {items.length} work{items.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Works in the list */}
      <div className="mt-4 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[560px] bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Stock</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2 font-mono text-[12px] text-ink">
                  <Link
                    href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                    className="hover:text-oranje"
                  >
                    {p.stock_number ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-body">
                  {p.title ?? "Untitled"}
                  {p.period || p.medium ? (
                    <span className="ml-2 text-[12px] text-ink-soft">
                      {[p.period, p.medium].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={removeItem}>
                    <input type="hidden" name="piece_id" value={p.id} />
                    <button type="submit" className="text-[12px] text-ink-soft hover:text-ink-strong">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                  No works yet — search below to add.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Add works */}
      <form method="get" className="mt-4 flex items-center gap-2">
        <input
          type="search"
          name="add"
          defaultValue={addQ}
          placeholder="Search works to add — stock no., title, maker…"
          className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
        />
        <button type="submit" className={btnGhost}>
          Search
        </button>
      </form>
      {addQ ? (
        <div className="mt-2 space-y-1">
          {results.map((p) => (
            <form
              key={p.id}
              action={addItem}
              className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
            >
              <input type="hidden" name="piece_id" value={p.id} />
              <span className="text-[13px] text-ink-body">
                <span className="font-mono text-[12px] text-ink-muted">{p.stock_number ?? "—"}</span>{" "}
                {p.title ?? "Untitled"}
              </span>
              <button type="submit" className={btnGhost}>
                Add
              </button>
            </form>
          ))}
          {results.length === 0 ? (
            <p className="text-[12.5px] text-ink-muted">No matches (or already in the list).</p>
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
