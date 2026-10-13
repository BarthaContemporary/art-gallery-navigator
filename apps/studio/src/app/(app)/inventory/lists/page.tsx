import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";
import { loadThumbnails } from "@/lib/thumbnails";
import { countListMembers, resolveListPieceIds, type ListLike } from "@/lib/list-members";

export const metadata = { title: "Inventory lists" };

export default async function InventoryListsPage() {
  const supabase = await getSupabase();
  const { data: lists } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, filter_rules, piece_list_items(count)")
    // Hand-set order first; name only to break ties, so rows sharing a
    // sort_order (a new list defaults to 0) stay put between requests.
    .order("sort_order")
    .order("name");

  // Live lists keep no rows in piece_list_items — membership is the saved
  // filters, re-run on read — so their real size has to be computed, not
  // counted from the join table.
  async function reorderLists(ids: string[]) {
    "use server";
    const db = await getSupabase();
    await persistOrder(db, "piece_lists", ids);
    revalidatePath("/inventory/lists");
  }

  // One count shared with the list page itself and the offers picker
  // (lib/list-members), so "not Sold" exclusions, the register, framed and
  // pinned-out works count here exactly as they do there. This page used to
  // re-implement it with plain equality, which read "!sold" as a status.
  const counts = new Map<string, number>();
  await Promise.all(
    ((lists ?? []) as unknown as (ListLike & { piece_list_items?: { count: number }[] })[]).map(
      async (l) => {
        counts.set(l.id, await countListMembers(supabase, l));
      },
    ),
  );

  // A strip of the first few works in each list — the picture is how a
  // dealer recognises a list, more than its name. Static lists in their
  // hand-set order; live lists as their filters resolve today.
  const PREVIEW = 4;
  const previewIds = new Map<string, string[]>();
  await Promise.all(
    ((lists ?? []) as unknown as (ListLike & { is_dynamic: boolean | null })[]).map(async (l) => {
      if (l.is_dynamic) {
        previewIds.set(l.id, (await resolveListPieceIds(supabase, l)).slice(0, PREVIEW));
        return;
      }
      const { data } = await supabase
        .from("piece_list_items")
        .select("piece_id")
        .eq("list_id", l.id)
        .eq("excluded", false)
        .order("sort_order", { nullsFirst: true })
        .limit(PREVIEW);
      previewIds.set(l.id, ((data ?? []) as { piece_id: string }[]).map((r) => r.piece_id));
    }),
  );
  const previewThumbs = await loadThumbnails(supabase, [...previewIds.values()].flat());

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

      {(lists ?? []).length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-muted">
          No lists yet — create one to group works (fair selections, viewing sets…).
        </p>
      ) : (
      <ReorderGrid
        order={(lists ?? []).map((l) => l.id as string)}
        onReorder={reorderLists}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        hint="Drag a grip to reorder these cards."
        showPosition={false}
        tiles={Object.fromEntries(
          (lists ?? []).map((l) => [
            l.id as string,
            <div key={l.id as string} className="h-full border border-line bg-cell p-4 pl-9">
            <a href={`/inventory/lists/${l.id}`} className="block">
              {(previewIds.get(l.id as string) ?? []).length > 0 ? (
                <div className="mb-3 flex gap-1.5">
                  {(previewIds.get(l.id as string) ?? []).map((pid) =>
                    previewThumbs.get(pid) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={pid}
                        src={previewThumbs.get(pid)}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 rounded-md object-cover"
                      />
                    ) : (
                      <span key={pid} aria-hidden className="jvb-hatch block h-14 w-14 rounded-md" />
                    ),
                  )}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <h2 className="text-[14.5px] font-semibold text-ink-strong hover:text-accent-deep">
                  {l.name}
                </h2>
                {l.is_dynamic ? (
                  <span className="bg-oranje/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-accent-deep">
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
            </div>,
          ]),
        )}
      />
      )}
    </div>
  );
}
