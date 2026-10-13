import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { ReorderGrid } from "@/components/reorder-grid";
import { persistOrder } from "@/lib/reorder";
import { loadThumbnails } from "@/lib/thumbnails";
import { countListMembers, resolveListPieceIds, type ListLike } from "@/lib/list-members";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { WebsiteDot } from "@/components/ui/website-switch";
import { ImageIcon } from "@/components/ui/icons";

export const metadata = { title: "Inventory lists" };

export default async function InventoryListsPage() {
  const supabase = await getSupabase();
  const { data: lists } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, filter_rules, web_visible, piece_list_items(count)")
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

  const count = (lists ?? []).length;

  return (
    <div>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title="Inventory lists"
        meta={`${formatCount(count)} ${count === 1 ? "list" : "lists"}`}
      />

      <Section title="New list" meta="Group works for a fair, a viewing or a catalogue. Add works from the list page or from the inventory.">
        <form action={addList} className="flex flex-wrap items-end gap-2">
          <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
            <label htmlFor="new-list-name" className="label">
              List name
            </label>
            <input
              id="new-list-name"
              name="name"
              placeholder="e.g. Asian Art in London 2026"
              className="field"
            />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1 sm:w-80">
            <label htmlFor="new-list-description" className="label">
              Description <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input id="new-list-description" name="description" className="field" />
          </div>
          <Button type="submit" variant="primary" pendingLabel="Creating…">
            Create list
          </Button>
        </form>
      </Section>

      <Section title="All lists" className="mt-6">
        {count === 0 ? (
          <EmptyState>No lists yet. Create one above to group works for a fair, a viewing or a catalogue.</EmptyState>
        ) : (
          <ReorderGrid
            order={(lists ?? []).map((l) => l.id as string)}
            onReorder={reorderLists}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            hint="Drag a grip, or focus it and press the arrow keys, to reorder these cards."
            showPosition={false}
            tiles={Object.fromEntries(
              (lists ?? []).map((l) => {
                const n = counts.get(l.id) ?? 0;
                const preview = previewIds.get(l.id as string) ?? [];
                return [
                  l.id as string,
                  <div key={l.id as string} className="h-full border border-rule p-4 pl-11">
                    <Link href={`/inventory/lists/${l.id}`} className="group block">
                      {preview.length > 0 ? (
                        <div className="mb-3 flex gap-1.5">
                          {preview.map((pid) =>
                            previewThumbs.get(pid) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={pid}
                                src={previewThumbs.get(pid)}
                                alt=""
                                loading="lazy"
                                className="h-14 w-14 object-cover"
                              />
                            ) : (
                              <span
                                key={pid}
                                aria-hidden
                                className="jvb-hatch flex h-14 w-14 items-center justify-center text-meta"
                              >
                                <ImageIcon size={14} />
                              </span>
                            ),
                          )}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14.5px] font-semibold leading-[1.45] text-ink group-hover:underline group-hover:underline-offset-2">
                          {l.name}
                        </h2>
                        {l.is_dynamic ? <Badge tone="info">Live</Badge> : null}
                      </div>
                      {l.description ? (
                        <p className="mt-1 text-[13px] leading-[1.45] text-body">{l.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[1.4] text-meta">
                        <span className="tabular">
                          {formatCount(n)} work{n === 1 ? "" : "s"}
                          {l.is_dynamic ? ", membership is live" : ""}
                        </span>
                        <WebsiteDot on={Boolean(l.web_visible)} />
                      </div>
                    </Link>
                  </div>,
                ];
              }),
            )}
          />
        )}
      </Section>
    </div>
  );
}
