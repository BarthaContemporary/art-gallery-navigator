import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { StatusPill } from "@/components/status-pill";
import { loadPieceSummaries, loadPieceRows } from "@/lib/piece-store";
import { loadThumbnails } from "@/lib/thumbnails";
import { PublishListButton } from "@/components/publish-list-button";
import { resolvePieces, byTable } from "@/lib/piece-store";
import { chunkIds, selectInChunks } from "@/lib/chunk";
import { resolveListPieceIds, listExcludedIds, type ListLike } from "@/lib/list-members";
import { titleWithYear } from "@jvb/db";
import { applyFacet, facetMatches, parseFacet } from "@/lib/facet";
import { LabelPdfButton } from "@/components/label-pdf-button";

export const metadata = { title: "Inventory list" };

const btnGhost =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

type PieceLite = {
  id: string;
  stock_number: string | null;
  title: string | null;
  medium: string | null;
  period: string | null;
  status: string | null;
  year: string | null;
};

type FilterRules = {
  q?: string | null;
  status?: string | null;
  category?: string | null;
  location?: string | null;
  framed?: boolean | null;
};

export default async function InventoryListDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string; notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();

  const { data: list } = await supabase
    .from("piece_lists")
    .select("id, name, description, is_dynamic, filter_rules, web_visible")
    .eq("id", id)
    .maybeSingle();
  if (!list) notFound();

  const isDynamic = Boolean(list.is_dynamic);
  const rules = (list.filter_rules ?? {}) as FilterRules;
  const listOnWebsite = Boolean((list as { web_visible?: boolean | null }).web_visible);

  // ---- Members -------------------------------------------------------------
  let items: PieceLite[] = [];
  /** When each work was added to this list, for static lists only. */
  let addedAt = new Map<string, string>();
  /** Works edited since they were added — the "already handled" marker. */
  const editedSinceAdded = new Set<string>();
  if (isDynamic) {
    // Re-run the saved filters through the shared resolver, so the page, the
    // publish-all action, exports and offers all agree on the membership.
    const ids = await resolveListPieceIds(supabase, list as ListLike);
    const summaries = await loadPieceSummaries(supabase, ids);
    items = ids.map((pid) => summaries.get(pid)).filter(Boolean) as unknown as PieceLite[];
  } else {
    const { data: itemRows } = await supabase
      .from("piece_list_items")
      .select("sort_order, piece_id, created_at")
      .eq("list_id", id)
      .eq("excluded", false)
      .order("sort_order", { nullsFirst: true });
    const summaries = await loadPieceSummaries(
      supabase,
      ((itemRows ?? []) as { piece_id: string }[]).map((r) => r.piece_id),
    );
    // .in() does not preserve order, so walk the ordered rows.
    items = ((itemRows ?? []) as { piece_id: string }[])
      .map((r) => summaries.get(r.piece_id))
      .filter(Boolean) as unknown as PieceLite[];

    // Which of these have been worked on since they landed in the list?
    // A list like "needs cataloguing" is a worklist, and the question it has to
    // answer at a glance is "which have I already done?". `updated_at` is
    // stamped by a trigger on every write to the record, so comparing it with
    // when the work was added to the list answers exactly that — without
    // storing any new state, and without a "done" flag anyone has to remember
    // to tick. Dynamic lists have no membership rows, so no anchor and no mark.
    addedAt = new Map(
      ((itemRows ?? []) as { piece_id: string; created_at: string }[]).map((r) => [
        r.piece_id,
        r.created_at,
      ]),
    );
    const touched = await loadPieceRows<{ id: string; updated_at: string | null }>(
      supabase,
      items.map((p) => p.id),
      "id, updated_at",
    );
    // A bulk "put all on the website" also stamps updated_at, which would mark
    // every work as handled. The change log says what actually changed, so a
    // record whose only edits since it was added touched visibility (or the
    // bookkeeping columns) keeps its unmarked state.
    const BOOKKEEPING = new Set(["old", "new", "updated_at", "updated_by", "web_visible", "search_vector"]);
    const realEdit = new Map<string, boolean>();
    const earliestAdded = [...addedAt.values()].sort()[0];
    if (earliestAdded && items.length > 0) {
      const logRows = await selectInChunks<{ entity_id: string; created_at: string; changes: Record<string, unknown> | null }>(
        items.map((p) => p.id),
        (chunk) =>
          supabase
            .from("activity_log")
            .select("entity_id, created_at, changes")
            .in("entity_id", chunk)
            .in("entity_type", ["pieces", "external_pieces", "piece_financials"])
            .gt("created_at", earliestAdded),
      );
      for (const row of logRows) {
        const added = addedAt.get(row.entity_id);
        if (!added || new Date(row.created_at) <= new Date(added)) continue;
        const keys = Object.keys(row.changes ?? {});
        const substantive = keys.length === 0 || keys.some((k) => !BOOKKEEPING.has(k));
        if (substantive) realEdit.set(row.entity_id, true);
        else if (!realEdit.has(row.entity_id)) realEdit.set(row.entity_id, false);
      }
    }
    for (const p of items) {
      const added = addedAt.get(p.id);
      const updated = touched.get(p.id)?.updated_at;
      if (!(added && updated && new Date(updated) > new Date(added))) continue;
      // Logged edits decide; with no log entry (older than retention) fall
      // back to the timestamp as before.
      const logged = realEdit.get(p.id);
      if (logged === false) continue;
      editedSinceAdded.add(p.id);
    }
  }
  // Works pinned out of a live list: subtract from the display and show them
  // in their own section with a Reinstate control. resolveListPieceIds does
  // the same subtraction for every other consumer (inventory filter, exports,
  // labels, offers), so the page and the artifacts always agree.
  let excludedItems: PieceLite[] = [];
  if (isDynamic) {
    const excludedIds = await listExcludedIds(supabase, id);
    if (excludedIds.size > 0) {
      items = items.filter((p) => !excludedIds.has(p.id));
      const summaries = await loadPieceSummaries(supabase, [...excludedIds]);
      excludedItems = [...excludedIds]
        .map((pid) => summaries.get(pid))
        .filter(Boolean) as unknown as PieceLite[];
    }
  }

  const existing = new Set(items.map((p) => p.id));

  // Thumbnails for the rows, from the same helper the shipment lists use, so a
  // work shows the same image everywhere. This page used to pick purely by
  // sort_order and could therefore show a different shot than the inventory
  // list, which prefers the 'front' role.
  // Also the excluded works and the add-search results, so every row that
  // names a work shows its picture.
  // Which of these works are on the website, for the publish-all control.
  const visibleRows = await selectInChunks<{ id: string; web_visible: boolean | null }>(
    items.map((p) => p.id),
    (chunk) => supabase.from("vw_pieces_list").select("id, web_visible").in("id", chunk),
  );
  // vw_pieces_list excludes soft-deleted works; a static list may still name
  // one, so the page counts (and the publish control) follow the view.
  const liveIds = new Set(visibleRows.map((r) => r.id));
  items = items.filter((p) => liveIds.has(p.id));
  const onWebsite = visibleRows.filter((r) => r.web_visible).length;

  const thumbByPiece = await loadThumbnails(supabase, [
    ...items.map((p) => p.id),
    ...excludedItems.map((p) => p.id),
  ]);

  // Human-readable rules summary for dynamic lists.
  let rulesSummary: string[] = [];
  if (isDynamic) {
    const [{ data: cats }, { data: locs }] = await Promise.all([
      rules.category
        ? supabase.from("categories").select("id, name").eq("id", parseFacet(rules.category)?.value ?? "")
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      rules.location
        ? supabase.from("locations").select("id, code").eq("id", parseFacet(rules.location)?.value ?? "")
        : Promise.resolve({ data: [] as { id: string; code: string }[] }),
    ]);
    const fS = parseFacet(rules.status);
    const fC = parseFacet(rules.category);
    const fL = parseFacet(rules.location);
    if (rules.q) rulesSummary.push(`matching “${rules.q}”`);
    if (fS) rulesSummary.push(`status ${fS.exclude ? "not " : ""}${fS.value.replace(/_/g, " ")}`);
    if (fC) rulesSummary.push(`category ${fC.exclude ? "not " : ""}${cats?.[0]?.name ?? fC.value}`);
    if (fL) rulesSummary.push(`location ${fL.exclude ? "not " : ""}${locs?.[0]?.code ?? fL.value}`);
    if (rules.framed) rulesSummary.push("framed");
    if (rulesSummary.length === 0) rulesSummary = ["all works"];
  }

  // ---- Add search (static lists only) --------------------------------------
  // Ranked search, minus works already in the list. Only the first page of
  // matches is shown, and the page says so: a broad word like "bronze" matches
  // a few hundred works, and once the first twenty had been added the rest
  // looked as if they didn't exist.
  const ADD_PAGE = 50;
  const addQ = (sp.add ?? "").trim();
  let results: PieceLite[] = [];
  let addMatches = 0;
  let hitsTotal: number | null = null;
  if (addQ && !isDynamic) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    hitsTotal = (hits ?? []).length;
    const notInList = ((hits ?? []) as PieceLite[]).filter((p) => !existing.has(p.id));
    addMatches = notInList.length;
    results = notInList.slice(0, ADD_PAGE);
    for (const [pid, url] of await loadThumbnails(supabase, results.map((p) => p.id))) thumbByPiece.set(pid, url);
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

  /** Add every work shown in the search results in one go. */
  async function addShown(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const ids = String(formData.get("piece_ids") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (ids.length === 0) return;
    const { data: mx } = await db
      .from("piece_list_items")
      .select("sort_order")
      .eq("list_id", id)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    let sort = (mx?.sort_order ?? -1) + 1;
    await db.from("piece_list_items").upsert(
      ids.map((piece_id) => ({ list_id: id, piece_id, sort_order: sort++ })),
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

  async function excludeItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    // The exclusion is a pin, not a rule change: the work stays out however
    // the live filters resolve. sort_order is irrelevant on an exclusion row.
    await db.from("piece_list_items").upsert(
      { list_id: id, piece_id: pieceId, excluded: true },
      { onConflict: "list_id,piece_id" },
    );
    revalidatePath(`/inventory/lists/${id}`);
  }

  async function reinstateItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("piece_list_items")
      .delete()
      .eq("list_id", id)
      .eq("piece_id", String(formData.get("piece_id") ?? ""))
      .eq("excluded", true);
    revalidatePath(`/inventory/lists/${id}`);
  }

  /**
   * Freeze the live list's current membership (exclusions applied) into a new
   * static list, open for hand editing. The live list itself is untouched.
   */
  async function copyAsStatic() {
    "use server";
    const db = await getSupabase();
    const { data: src } = await db
      .from("piece_lists")
      .select("id, name, is_dynamic, filter_rules")
      .eq("id", id)
      .maybeSingle();
    if (!src) redirect(`/inventory/lists/${id}`);
    const ids = await resolveListPieceIds(db, src as ListLike);
    const { data: created, error } = await db
      .from("piece_lists")
      .insert({ name: `${src.name} (copy)`, is_dynamic: false })
      .select("id")
      .single();
    if (error || !created)
      redirect(`/inventory/lists/${id}?error=${encodeURIComponent(error?.message ?? "Could not copy")}`);
    if (ids.length > 0) {
      await db
        .from("piece_list_items")
        .insert(ids.map((pieceId, i) => ({ list_id: created.id, piece_id: pieceId, sort_order: i })));
    }
    redirect(`/inventory/lists/${created.id}`);
  }

  /**
   * Put the whole list on the website, or take it off. Resolves the list
   * afresh (live rules or static members minus exclusions), writes
   * web_visible through the right register table, and the sync triggers push
   * the change to the site within a minute (pg_net) — nothing else to do.
   */
  async function setListVisibility(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/login");
    const visible = formData.get("visible") === "on";
    const { data: src } = await db
      .from("piece_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", id)
      .maybeSingle();
    if (!src) redirect(`/inventory/lists/${id}`);
    const ids = await resolveListPieceIds(db, src as ListLike);
    if (ids.length === 0) redirect(`/inventory/lists/${id}?error=${encodeURIComponent("The list is empty")}`);
    const groups = byTable((await resolvePieces(db, ids)).values());
    // Only rows in the other state are touched; the returned ids are the true
    // count. RLS filters silently, so zero rows for a non-empty list means the
    // signed-in role may not publish — say so rather than claim success.
    let candidates = 0;
    let changed = 0;
    let failure: string | null = null;
    for (const [table, tableIds] of Object.entries(groups) as [keyof typeof groups, string[]][]) {
      if (tableIds.length === 0) continue;
      const { data: before } = await db.from(table).select("id").in("id", tableIds).eq("web_visible", !visible);
      candidates += (before ?? []).length;
      for (const chunk of chunkIds(tableIds)) {
        const { data, error } = await db
          .from(table)
          .update({ web_visible: visible, updated_by: user.id })
          .eq("web_visible", !visible)
          .in("id", chunk)
          .select("id");
        if (error) {
          failure = error.message;
          break;
        }
        changed += (data ?? []).length;
      }
      if (failure) break;
    }
    revalidatePath(`/inventory/lists/${id}`);
    const pace = changed > 24 ? "over the next few minutes" : "within a minute";
    if (failure) {
      redirect(`/inventory/lists/${id}?error=${encodeURIComponent(`Stopped after ${changed} of ${candidates}: ${failure}`)}`);
    }
    if (candidates > 0 && changed === 0) {
      redirect(`/inventory/lists/${id}?error=${encodeURIComponent("Nothing changed — your role may not publish works. Ask an admin.")}`);
    }
    redirect(
      `/inventory/lists/${id}?notice=${encodeURIComponent(
        changed === 0
          ? visible
            ? "Every work in this list was already on the website."
            : "No work in this list was on the website."
          : visible
            ? `${changed} work${changed === 1 ? "" : "s"} switched to “On website — yes”. The site updates ${pace}.`
            : `${changed} work${changed === 1 ? "" : "s"} taken off the website. The site updates ${pace}.`,
      )}`,
    );
  }

  async function toggleListOnWebsite(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const to = formData.get("to") === "on";
    const { error } = await db.from("piece_lists").update({ web_visible: to }).eq("id", id);
    if (error) redirect(`/inventory/lists/${id}?error=${encodeURIComponent(error.message)}`);
    revalidatePath(`/inventory/lists/${id}`);
    redirect(
      `/inventory/lists/${id}?notice=${encodeURIComponent(
        to
          ? "This list is now available to events on the website; its web-visible works follow within a minute."
          : "This list has been withdrawn from the website.",
      )}`,
    );
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
      {sp.error ? (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{sp.error}</p>
      ) : null}
      {sp.notice ? (
        <p className="mt-3 rounded-lg border border-status-green/40 bg-band px-3 py-2 text-[12.5px] text-ink-body">{sp.notice}</p>
      ) : null}
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
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
            {items.length} work{items.length === 1 ? "" : "s"}
            {items.length > 0 ? ` · ${onWebsite} on the website` : ""}
          </p>
          {/* Whether the list itself is available to events on the website.
              Independent of the works' own visibility: a list on the website
              only ever shows its web-visible works. */}
          <form action={toggleListOnWebsite}>
            <input type="hidden" name="to" value={listOnWebsite ? "" : "on"} />
            <button
              type="submit"
              role="switch"
              aria-checked={listOnWebsite}
              title={listOnWebsite ? "Events on the website can use this list — click to withdraw it" : "Not available on the website — click to let events use it"}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium ${
                listOnWebsite ? "border-status-green/60 bg-control text-ink-mid" : "border-line-control bg-control text-ink-muted"
              }`}
            >
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: listOnWebsite ? "var(--jvb-status-green)" : "var(--jvb-danger)" }} />
              {listOnWebsite ? "List on website — yes" : "List on website — no"}
            </button>
          </form>
          <PublishListButton action={setListVisibility} count={items.length} onCount={onWebsite} visible />
          <PublishListButton action={setListVisibility} count={items.length} onCount={onWebsite} visible={false} />
          {/* Says what the dot means, and only appears once there is one. */}
          {editedSinceAdded.size > 0 ? (
            <p className="flex items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
              <span
                aria-hidden
                className="inline-block h-[7px] w-[7px] rounded-full"
                style={{ background: "var(--jvb-status-green)" }}
              />
              {editedSinceAdded.size} edited since added
            </p>
          ) : null}
          {/* Object labels for the whole list — same Avery chooser as the
              contact mailing labels; the PDF carries framed + unframed sizes. */}
          <LabelPdfButton
            listId={id}
            endpoint="/api/export/work-labels.pdf"
            buttonLabel="Work labels PDF"
            filePrefix="work-labels"
          />
          {isDynamic ? (
            <form action={copyAsStatic}>
              <button
                type="submit"
                title="Freeze the current membership into a new static list you can edit by hand. This live list is untouched."
                className="text-[12px] font-medium text-primary"
              >
                Save as editable copy
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* Add works — above the table, because adding is what you come here to
          do; hunting for the box under a few hundred rows was the complaint. */}
      {isDynamic ? null : (
        <div className="mt-4">
          <form method="get" className="flex items-center gap-2">
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
              {results.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                  <p className="text-[12.5px] text-ink-muted">
                    {addMatches > results.length
                      ? `Showing the first ${results.length} of ${addMatches} matches not yet in the list — narrow the search to find a specific work (a stock number finds just that one).`
                      : `${results.length} match${results.length === 1 ? "" : "es"} not yet in the list.`}
                  </p>
                  <form action={addShown}>
                    <input type="hidden" name="piece_ids" value={results.map((p) => p.id).join(",")} />
                    <button type="submit" className={btnGhost}>
                      Add all {results.length} shown
                    </button>
                  </form>
                </div>
              ) : null}
              {results.map((p) => (
                <form
                  key={p.id}
                  action={addItem}
                  className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
                >
                  <input type="hidden" name="piece_id" value={p.id} />
                  <span className="flex min-w-0 items-center gap-3 text-[13px] text-ink-body">
                    <Thumb src={thumbByPiece.get(p.id)} />
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[12px] text-ink-muted">
                        {p.stock_number ?? "—"}
                      </span>{" "}
                      {titleWithYear(p.title, p.year)}
                    </span>
                  </span>
                  <button type="submit" className={btnGhost}>
                    Add
                  </button>
                </form>
              ))}
              {results.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  {addMatches === 0 && (hitsTotal ?? 0) > 0
                    ? "Every match is already in the list."
                    : "No matches — try a stock number, part of the title, or the maker."}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Works in the list */}
      <div className="mt-4 overflow-x-auto rounded-[11px] border border-line">
        {/* No min-width: on a phone this forced 560px of sideways scrolling.
            The stock column hides below sm (it is already in the row's link)
            and the title wraps instead. */}
        <table className="w-full bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-3 py-2.5 font-medium" />
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Stock</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Availability</th>
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
                <td className="hidden px-4 py-2 font-mono text-[12px] text-ink sm:table-cell">
                  <Link
                    href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                    className="hover:text-oranje"
                  >
                    {p.stock_number ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-body">
                  {editedSinceAdded.has(p.id) ? (
                    <span
                      title="Edited since it was added to this list"
                      aria-label="Edited since it was added to this list"
                      className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-middle"
                      style={{ background: "var(--jvb-status-green)" }}
                    />
                  ) : null}
                  <Link
                    href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                    className="hover:text-oranje"
                  >
                    {titleWithYear(p.title, p.year)}
                  </Link>
                  {/* Stock number folds in here once its own column is hidden. */}
                  <span className="mt-0.5 block font-mono text-[11.5px] text-ink-muted sm:hidden">
                    {p.stock_number ?? "—"}
                  </span>
                  {p.period || p.medium ? (
                    <span className="mt-0.5 block text-[12px] text-ink-soft sm:ml-2 sm:mt-0 sm:inline">
                      {[p.period, p.medium].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </td>
                {/* Availability is read live even on a static list — the
                    membership is fixed, the works' status is not. */}
                <td className="px-4 py-2">
                  {p.status ? <StatusPill status={p.status} variant="inline" /> : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {isDynamic ? (
                    <form action={excludeItem}>
                      <input type="hidden" name="piece_id" value={p.id} />
                      <button
                        type="submit"
                        title="Pin this work out of the list. It stays out however the live filters resolve; reinstate it below at any time. The record itself is untouched."
                        className="text-[12px] text-ink-soft hover:text-ink-strong"
                      >
                        Exclude
                      </button>
                    </form>
                  ) : (
                    <form action={removeItem}>
                      <input type="hidden" name="piece_id" value={p.id} />
                      <button
                        type="submit"
                        title="Takes the work off this list only — the inventory record is untouched."
                        className="text-[12px] text-ink-soft hover:text-ink-strong"
                      >
                        Remove from list
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  {isDynamic
                    ? "No works currently match these filters."
                    : "No works yet — use the search above to add."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Works pinned out of this live list. Kept visible so an exclusion is
          never a silent disappearance, and reversible in one click. */}
      {excludedItems.length > 0 ? (
        <div className="mt-5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Excluded from this list ({excludedItems.length})
          </h2>
          <div className="mt-2 space-y-1.5">
            {excludedItems.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft bg-band/40 px-3 py-2"
              >
                <Link
                  href={`/inventory/${encodeURIComponent(p.stock_number ?? "")}`}
                  className="flex min-w-0 items-center gap-3 text-[13px] text-ink-muted hover:text-oranje"
                >
                  <Thumb src={thumbByPiece.get(p.id)} />
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-[12px]">{p.stock_number ?? "—"}</span>{" "}
                    {titleWithYear(p.title, p.year)}
                  </span>
                </Link>
                <form action={reinstateItem}>
                  <input type="hidden" name="piece_id" value={p.id} />
                  <button
                    type="submit"
                    className="text-[12px] font-medium text-[var(--jvb-ink-desc)] hover:text-ink-strong"
                  >
                    Reinstate
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isDynamic ? (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          This is a saved view. Works appear and disappear automatically as their
          details change — to edit which works are shown, adjust the{" "}
          <Link href="/inventory" className="text-oranje hover:underline">
            inventory filters
          </Link>{" "}
          and save a new list.
        </p>
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

/** The small square preview used in the list's side rows. */
function Thumb({ src }: { src: string | undefined }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
  ) : (
    <span aria-hidden className="jvb-hatch block h-10 w-10 shrink-0 rounded" />
  );
}
