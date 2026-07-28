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

type FilterRules = {
  q?: string | null;
  status?: string | null;
  category?: string | null;
  location?: string | null;
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
    .select("id, name, description, is_dynamic, filter_rules")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const isDynamic = Boolean(list.is_dynamic);
  const rules = (list.filter_rules ?? {}) as FilterRules;

  // ---- Members -------------------------------------------------------------
  let items: PieceLite[] = [];
  if (isDynamic) {
    // Re-run the saved filters live so membership always reflects inventory.
    const q = (rules.q ?? "").trim();
    if (q) {
      const { data: hits } = await supabase.rpc("pieces_search", { q });
      let filtered = (hits ?? []) as Array<{
        id: string;
        status: string;
        category_id: string | null;
        location_id: string | null;
      }>;
      if (rules.status) filtered = filtered.filter((h) => h.status === rules.status);
      if (rules.category) filtered = filtered.filter((h) => h.category_id === rules.category);
      if (rules.location) filtered = filtered.filter((h) => h.location_id === rules.location);
      const ids = filtered.slice(0, 500).map((h) => h.id);
      if (ids.length > 0) {
        const { data: viewRows } = await supabase
          .from("vw_pieces_list")
          .select("id, stock_number, title, medium, period")
          .in("id", ids);
        const byId = new Map(
          ((viewRows ?? []) as PieceLite[]).map((r) => [r.id, r]),
        );
        items = ids.map((i) => byId.get(i)).filter((r): r is PieceLite => Boolean(r));
      }
    } else {
      let query = supabase
        .from("vw_pieces_list")
        .select("id, stock_number, title, medium, period")
        .order("stock_number", { ascending: false, nullsFirst: false })
        .limit(500);
      if (rules.status) query = query.eq("status", rules.status);
      if (rules.category) query = query.eq("category_id", rules.category);
      if (rules.location) query = query.eq("location_id", rules.location);
      const { data } = await query;
      items = (data ?? []) as PieceLite[];
    }
  } else {
    const { data: itemRows } = await supabase
      .from("piece_list_items")
      .select("sort_order, piece:pieces ( id, stock_number, title, medium, period )")
      .eq("list_id", id)
      .order("sort_order", { nullsFirst: true });
    items = (itemRows ?? [])
      .map((r) => (r as unknown as { piece: PieceLite | null }).piece)
      .filter(Boolean) as PieceLite[];
  }
  const existing = new Set(items.map((p) => p.id));

  // Thumbnails for the rows. Resolved from the assembled ids rather than in the
  // two fetch paths above, so static and live lists behave identically: take
  // each work's first processed image by sort_order and sign it, exactly as the
  // inventory table does.
  const thumbByPiece = new Map<string, string>();
  if (items.length > 0) {
    const { data: imgs } = await supabase
      .from("piece_images")
      .select("piece_id, storage_path_display, sort_order")
      .in(
        "piece_id",
        items.map((p) => p.id),
      )
      .not("storage_path_display", "is", null)
      .order("sort_order", { ascending: true, nullsFirst: false });

    // First row per piece wins (the query is already in sort order).
    const firstByPiece = new Map<string, string>();
    (imgs ?? []).forEach((i) => {
      const pid = i.piece_id as string;
      if (pid && !firstByPiece.has(pid)) {
        firstByPiece.set(pid, i.storage_path_display as string);
      }
    });

    const entries = [...firstByPiece.entries()];
    if (entries.length > 0) {
      const { data: signed } = await supabase.storage
        .from("piece-derivatives")
        .createSignedUrls(
          entries.map(([, path]) => path),
          3600,
        );
      (signed ?? []).forEach((s, i) => {
        const pid = entries[i]?.[0];
        if (pid && s.signedUrl) thumbByPiece.set(pid, s.signedUrl);
      });
    }
  }

  // Human-readable rules summary for dynamic lists.
  let rulesSummary: string[] = [];
  if (isDynamic) {
    const [{ data: cats }, { data: locs }] = await Promise.all([
      rules.category
        ? supabase.from("categories").select("id, name").eq("id", rules.category)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      rules.location
        ? supabase.from("locations").select("id, code").eq("id", rules.location)
        : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    ]);
    if (rules.q) rulesSummary.push(`matching “${rules.q}”`);
    if (rules.status) rulesSummary.push(`status ${rules.status.replace(/_/g, " ")}`);
    if (rules.category)
      rulesSummary.push(`category ${cats?.[0]?.name ?? rules.category}`);
    if (rules.location)
      rulesSummary.push(`location ${locs?.[0]?.code ?? rules.location}`);
    if (rulesSummary.length === 0) rulesSummary = ["all works"];
  }

  // ---- Add search (static lists only) --------------------------------------
  const addQ = (sp.add ?? "").trim();
  let results: PieceLite[] = [];
  if (addQ && !isDynamic) {
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
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-semibold text-ink-strong">{list.name}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${
                isDynamic
                  ? "bg-oranje/10 text-oranje"
                  : "border border-line-control text-ink-soft"
              }`}
            >
              {isDynamic ? "Live" : "Static"}
            </span>
          </div>
          {list.description ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{list.description}</p>
          ) : null}
          {isDynamic ? (
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Live view — {rulesSummary.join(", ")}.
            </p>
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
              <th className="px-3 py-2.5 font-medium" />
              <th className="px-4 py-2.5 font-medium">Stock</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-line-soft last:border-0">
                <td className="px-3 py-1">
                  <Link
                    href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                    className="block"
                    aria-hidden
                    tabIndex={-1}
                  >
                    {thumbByPiece.get(p.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbByPiece.get(p.id)}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="jvb-hatch block h-10 w-10 rounded" />
                    )}
                  </Link>
                </td>
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
                  {isDynamic ? null : (
                    <form action={removeItem}>
                      <input type="hidden" name="piece_id" value={p.id} />
                      <button
                        type="submit"
                        className="text-[12px] text-ink-soft hover:text-ink-strong"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  {isDynamic
                    ? "No works currently match these filters."
                    : "No works yet — search below to add."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isDynamic ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          This is a saved view. Works appear and disappear automatically as their
          details change — to edit which works are shown, adjust the{" "}
          <Link href="/inventory" className="text-oranje hover:underline">
            inventory filters
          </Link>{" "}
          and save a new list.
        </p>
      ) : (
        <>
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
                    <span className="font-mono text-[12px] text-ink-muted">
                      {p.stock_number ?? "—"}
                    </span>{" "}
                    {p.title ?? "Untitled"}
                  </span>
                  <button type="submit" className={btnGhost}>
                    Add
                  </button>
                </form>
              ))}
              {results.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  No matches (or already in the list).
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

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
