import Link from "next/link";
import type { ReactNode } from "react";
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
import { ExportMenu } from "@/components/export-menu";
import { ReorderGrid, ReorderHandle } from "@/components/reorder-grid";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlashNotice } from "@/components/ui/notice";
import { Section } from "@/components/ui/section";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { WebsiteDot, WebsiteSwitch } from "@/components/ui/website-switch";
import { ImageIcon, PlusIcon } from "@/components/ui/icons";

export const metadata = { title: "Inventory list" };

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
  // Each row's own website state, for the dot beside it.
  const webById = new Map(visibleRows.map((r) => [r.id, Boolean(r.web_visible)]));

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
      redirect(`/inventory/lists/${id}?error=${encodeURIComponent("Nothing changed: your role may not publish works. Ask an admin.")}`);
    }
    redirect(
      `/inventory/lists/${id}?notice=${encodeURIComponent(
        changed === 0
          ? visible
            ? "Every work in this list was already on the website."
            : "No work in this list was on the website."
          : visible
            ? `${changed} work${changed === 1 ? "" : "s"} put on the website. The site updates ${pace}.`
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

  /**
   * The hand-set order of a static list, which the website's workList, the
   * labels and the exports all follow (lib/list-members). The same two
   * safeguards as lib/reorder's persistOrder, which cannot be used here
   * because piece_list_items is keyed by (list_id, piece_id) rather than id:
   * ids the browser sends that are not members are dropped, and members it
   * did not send (added in another tab) keep their place at the end. Only
   * rows whose position moved are written.
   */
  async function reorderItems(ids: string[]) {
    "use server";
    const db = await getSupabase();
    const { data, error } = await db
      .from("piece_list_items")
      .select("piece_id, sort_order")
      .eq("list_id", id)
      .eq("excluded", false);
    if (error) throw new Error(error.message);
    const current = new Map(
      ((data ?? []) as { piece_id: string; sort_order: number | null }[]).map((r) => [r.piece_id, r.sort_order]),
    );
    const ordered = ids.filter((pid) => current.has(pid));
    for (const pid of current.keys()) if (!ordered.includes(pid)) ordered.push(pid);
    const moved = ordered.map((pid, i) => [pid, i] as const).filter(([pid, i]) => current.get(pid) !== i);
    // An update per moved row, a few at a time: a list can run to hundreds.
    for (let at = 0; at < moved.length; at += 20) {
      const results = await Promise.all(
        moved
          .slice(at, at + 20)
          .map(([pid, i]) =>
            db.from("piece_list_items").update({ sort_order: i }).eq("list_id", id).eq("piece_id", pid),
          ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    }
    revalidatePath(`/inventory/lists/${id}`);
  }

  async function deleteList() {
    "use server";
    const db = await getSupabase();
    await db.from("piece_lists").delete().eq("id", id);
    redirect("/inventory/lists");
  }

  const n = items.length;
  const listHref = (p: PieceLite) => `/inventory/${encodeURIComponent(p.stock_number ?? "")}`;

  /** One member row; static lists hand these to ReorderGrid, which keys and orders them. */
  const memberRow = (p: PieceLite) => (
    <Tr key={p.id}>
      {isDynamic ? null : (
        <Td className="pr-0">
          <ReorderHandle id={p.id} />
        </Td>
      )}
      <Td className="pl-2 pr-2 sm:px-3">
        {/* The title links to the record; the picture is the same link,
            kept out of the tab order. */}
        <Link href={listHref(p)} className="block w-10" aria-hidden tabIndex={-1}>
          <Thumb src={thumbByPiece.get(p.id)} />
        </Link>
      </Td>
      <Td className="hidden md:table-cell">
        <Link href={listHref(p)} className="link-plain tabular text-ink">
          {p.stock_number ?? "—"}
        </Link>
      </Td>
      <Td>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={listHref(p)} className="link-plain text-ink">
            {titleWithYear(p.title, p.year)}
          </Link>
          {editedSinceAdded.has(p.id) ? (
            // A fact about the work, not a success: info, not ok (spec R4).
            <Badge tone="info" size="xs" title="Edited since it was added to this list">
              Edited
            </Badge>
          ) : null}
        </span>
        {p.period || p.medium ? (
          <span className="mt-0.5 block text-[12px] leading-[1.4] text-meta">
            {[p.period, p.medium].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        {/* The columns a narrow screen drops fold in under the title. */}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] leading-[1.4] lg:hidden">
          <span className="tabular text-meta md:hidden">{p.stock_number ?? "—"}</span>
          {p.status ? (
            <span className="sm:hidden">
              <StatusPill status={p.status} variant="inline" />
            </span>
          ) : null}
          <WebsiteDot on={webById.get(p.id) ?? false} />
        </span>
      </Td>
      {/* Availability is read live even on a static list: the membership is
          fixed, the works' status is not. */}
      <Td className="hidden sm:table-cell">
        {p.status ? <StatusPill status={p.status} variant="inline" /> : "—"}
      </Td>
      <Td className="hidden lg:table-cell">
        <WebsiteDot on={webById.get(p.id) ?? false} />
      </Td>
      {/* Tighter at phone width, where every pixel the title loses is a line. */}
      <Td className="pl-1 pr-0 text-right sm:px-3">
        {isDynamic ? (
          <form action={excludeItem}>
            <input type="hidden" name="piece_id" value={p.id} />
            <Button
              type="submit"
              variant="quiet"
              size="sm"
              className="text-body"
              aria-label={`Exclude ${p.stock_number ?? "this work"} from this list`}
              title="Pin this work out of the list. It stays out however the live filters resolve; reinstate it below at any time. The record itself is untouched."
            >
              Exclude
            </Button>
          </form>
        ) : (
          <form action={removeItem}>
            <input type="hidden" name="piece_id" value={p.id} />
            <Button
              type="submit"
              variant="quiet"
              size="sm"
              className="text-body"
              aria-label={`Remove ${p.stock_number ?? "this work"} from this list`}
              title="Takes the work off this list only. The inventory record is untouched."
            >
              Remove
            </Button>
          </form>
        )}
      </Td>
    </Tr>
  );
  const columns = isDynamic ? 6 : 7;

  return (
    <div className="max-w-[960px]">
      <PageHeader
        back={{ href: "/inventory/lists", label: "All inventory lists" }}
        title={list.name}
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge tone={isDynamic ? "info" : "neutral"}>{isDynamic ? "Live" : "Static"}</Badge>
            <span className="tabular">
              {formatCount(n)} work{n === 1 ? "" : "s"}
              {n > 0 ? `, ${formatCount(onWebsite)} on the website` : ""}
            </span>
          </span>
        }
      >
        {list.description || isDynamic ? (
          <div className="max-w-[640px] space-y-1 text-[13px] leading-[1.45] text-body">
            {list.description ? <p>{list.description}</p> : null}
            {isDynamic ? <p>Live view: {rulesSummary.join(", ")}.</p> : null}
          </div>
        ) : null}
      </PageHeader>

      <FlashNotice searchParams={sp} className="mb-4" />

      {/* What the list does outside the studio, apart from what it makes.
          Two groups rather than one row of eight equal controls. */}
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ToolGroup title="Website">
          {/* Whether the list itself is available to events on the website.
              Independent of the works' own visibility: a list on the website
              only ever shows its web-visible works. */}
          <form action={toggleListOnWebsite}>
            <input type="hidden" name="to" value={listOnWebsite ? "" : "on"} />
            <WebsiteSwitch
              type="submit"
              on={listOnWebsite}
              onLabel="List on website"
              offLabel="List not on website"
              title={
                listOnWebsite
                  ? "Events on the website can use this list. Click to withdraw it."
                  : "Not available on the website. Click to let events use it."
              }
            />
          </form>
          <PublishListButton action={setListVisibility} count={n} onCount={onWebsite} visible />
          <PublishListButton action={setListVisibility} count={n} onCount={onWebsite} visible={false} />
        </ToolGroup>
        <ToolGroup title="Output">
          {/* Object labels for the whole list: the same Avery chooser as the
              contact mailing labels; the PDF carries framed and unframed sizes. */}
          <LabelPdfButton
            listId={id}
            endpoint="/api/export/work-labels.pdf"
            buttonLabel="Work labels PDF"
            filePrefix="work-labels"
          />
          {/* The list's own exports (api/export/list.*), in the list's order.
              Nothing to export from an empty list. */}
          {n > 0 ? (
            <ExportMenu
              size="sm"
              align="left"
              count={n}
              noun={n === 1 ? "work" : "works"}
              items={[
                { href: `/api/export/list.xlsx?list=${id}`, label: "Excel (XLSX)" },
                { href: `/api/export/list.docx?list=${id}`, label: "Word (DOCX)" },
              ]}
            />
          ) : null}
          {isDynamic ? (
            <form action={copyAsStatic}>
              <Button
                type="submit"
                size="sm"
                pendingLabel="Copying…"
                title="Freeze the current membership into a new static list you can edit by hand. This live list is untouched."
              >
                Save as editable copy
              </Button>
            </form>
          ) : null}
        </ToolGroup>
      </div>

      {/* Add works: above the table, because adding is what you come here to
          do; hunting for the box under a few hundred rows was the complaint. */}
      {isDynamic ? null : (
        <Section title="Add works" className="mt-6">
          <form method="get" role="search" className="flex flex-wrap items-end gap-2">
            <div className="flex w-full min-w-0 max-w-md flex-col gap-1">
              <label htmlFor="list-add-search" className="label">
                Find works to add
              </label>
              <input
                id="list-add-search"
                type="search"
                name="add"
                defaultValue={addQ}
                placeholder="Stock no., title, maker…"
                className="field"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          {addQ ? (
            <div className="mt-3">
              {results.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <p className="text-[12px] leading-[1.4] text-meta">
                    {addMatches > results.length
                      ? `Showing the first ${results.length} of ${addMatches} matches not yet in the list. Narrow the search to find a specific work (a stock number finds just that one).`
                      : `${results.length} match${results.length === 1 ? "" : "es"} not yet in the list.`}
                  </p>
                  <form action={addShown}>
                    <input type="hidden" name="piece_ids" value={results.map((p) => p.id).join(",")} />
                    <Button type="submit" size="sm" pendingLabel="Adding…">
                      Add all {results.length} shown
                    </Button>
                  </form>
                </div>
              ) : null}
              {results.length > 0 ? (
                <ul className="border-t border-rule">
                  {results.map((p) => (
                    <li key={p.id} className="border-b border-rule">
                      <form action={addItem} className="flex items-center justify-between gap-3 py-1.5">
                        <input type="hidden" name="piece_id" value={p.id} />
                        <span className="flex min-w-0 items-center gap-3 text-[13px] leading-[1.45] text-ink">
                          <Thumb src={thumbByPiece.get(p.id)} />
                          <span className="min-w-0 truncate">
                            <span className="tabular text-meta">{p.stock_number ?? "—"}</span>{" "}
                            {titleWithYear(p.title, p.year)}
                          </span>
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          icon={<PlusIcon size={14} />}
                          pendingLabel="Adding…"
                          aria-label={`Add ${p.stock_number ?? "this work"} to the list`}
                        >
                          Add
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-[1.45] text-body">
                  {addMatches === 0 && (hitsTotal ?? 0) > 0
                    ? "Every match is already in the list."
                    : "No matches. Try a stock number, part of the title, or the maker."}
                </p>
              )}
            </div>
          ) : null}
        </Section>
      )}

      <Section
        title="Works in this list"
        className="mt-6"
        meta={
          isDynamic
            ? "In the order the live filters give them."
            : n > 1
              ? "Drag a grip, or focus it and press the arrow keys, to set the order the website, labels and exports follow."
              : undefined
        }
        actions={
          // Says what the Edited tag means, and only once there is one.
          editedSinceAdded.size > 0 ? (
            <p className="text-[12px] leading-[1.4] text-meta">
              <span className="tabular">{editedSinceAdded.size}</span> edited since added
            </p>
          ) : null
        }
      >
        <TableFrame>
          <Table>
            <thead>
              <tr>
                {isDynamic ? null : (
                  <Th className="w-10 pr-0">
                    <span className="sr-only">Order</span>
                  </Th>
                )}
                <Th className="w-14 pl-2 pr-2 sm:w-16 sm:px-3">
                  <span className="sr-only">Image</span>
                </Th>
                <Th className="hidden w-28 md:table-cell">Stock</Th>
                <Th>Title</Th>
                <Th className="hidden w-36 sm:table-cell">Availability</Th>
                <Th className="hidden w-36 lg:table-cell">Website</Th>
                <Th className="w-[76px] sm:w-24">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            {n > 0 && !isDynamic ? (
              <ReorderGrid
                variant="rows"
                order={items.map((p) => p.id)}
                tiles={Object.fromEntries(items.map((p) => [p.id, memberRow(p)]))}
                onReorder={reorderItems}
              />
            ) : (
              <tbody>
                {items.map(memberRow)}
                {n === 0 ? (
                  <EmptyRow colSpan={columns}>
                    {isDynamic
                      ? "No works currently match these filters."
                      : "No works yet. Use the search above to add some."}
                  </EmptyRow>
                ) : null}
              </tbody>
            )}
          </Table>
        </TableFrame>
        {isDynamic ? (
          <p className="mt-3 max-w-[640px] text-[13px] leading-[1.45] text-body">
            This is a saved view. Works appear and disappear automatically as their details change. To
            change which works are shown, adjust the{" "}
            <Link href="/inventory" className="link">
              inventory filters
            </Link>{" "}
            and save a new list.
          </p>
        ) : null}
      </Section>

      {/* Works pinned out of this live list. Kept visible so an exclusion is
          never a silent disappearance, and reversible in one click. */}
      {excludedItems.length > 0 ? (
        <Section
          title="Excluded from this list"
          meta={`${formatCount(excludedItems.length)} pinned out. Reinstate a work to let the filters decide again.`}
          className="mt-6"
        >
          <ul className="border-t border-rule">
            {excludedItems.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-1.5">
                <Link
                  href={listHref(p)}
                  className="link-plain flex min-w-0 items-center gap-3 text-[13px] leading-[1.45] text-body"
                >
                  <Thumb src={thumbByPiece.get(p.id)} />
                  <span className="min-w-0 truncate">
                    <span className="tabular text-meta">{p.stock_number ?? "—"}</span>{" "}
                    {titleWithYear(p.title, p.year)}
                  </span>
                </Link>
                <form action={reinstateItem}>
                  <input type="hidden" name="piece_id" value={p.id} />
                  <Button type="submit" size="sm" pendingLabel="Reinstating…">
                    Reinstate
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="mt-10 border-t border-rule-strong pt-4">
        <form action={deleteList}>
          <Button type="submit" variant="danger" size="sm" pendingLabel="Deleting…">
            Delete list
          </Button>
        </form>
      </div>
    </div>
  );
}

/** A labelled group of controls in the page's toolbar. */
function ToolGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="border-t border-rule-strong pt-2">
      <p className="label mb-2" aria-hidden>
        {title}
      </p>
      <div className="flex flex-wrap items-start gap-2">{children}</div>
    </div>
  );
}

/** The small square picture used in the list's rows. */
function Thumb({ src }: { src: string | undefined }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className="h-10 w-10 shrink-0 object-cover" />
  ) : (
    <span aria-hidden className="jvb-hatch flex h-10 w-10 shrink-0 items-center justify-center text-meta">
      <ImageIcon size={14} />
    </span>
  );
}
