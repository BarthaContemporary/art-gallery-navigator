import { signedThumbnail, THUMB_WIDTH } from "@/lib/thumbnails";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { InventoryTable, type InventoryRow } from "@/components/inventory-table";
import { NewRecordButton } from "@/components/new-record-button";
import { InventoryFilters } from "@/components/inventory-filters";
import { ExportMenu } from "@/components/export-menu";
import { STATUS_LABELS } from "@/components/status-pill";
import { PageHeader } from "@/components/ui/page-header";
import { Button, ButtonLink, buttonClass } from "@/components/ui/button";
import { FlashNotice, Notice } from "@/components/ui/notice";
import { Panel } from "@/components/ui/section";
import { Pager } from "@/components/ui/pager";
import { chipClass } from "@/components/ui/chips";
import { CloseIcon, FlagIcon } from "@/components/ui/icons";
import { formatCount } from "@/lib/format";
import { createDraftPiece } from "./actions";
import { applyFacet, parseFacet } from "@/lib/facet";
import {
  FLAG_FILTERS,
  SCREEN_ORDER,
  applyFlagFilters,
  applyWebFilter,
  inventoryOrder,
  resolveInventoryIds,
  selectInventoryRows,
} from "@/lib/inventory-query";

const PAGE_SIZE = 100;

type Search = {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  /** "" / absent = JvdB stock only, "external" = the non-JvdB register, "all" = both. */
  ledger?: string;
  list?: string;
  /** "1" = only the works the current user has flagged. */
  flagged?: string;
  loan?: string;
  needs?: string;
  nopurchase?: string;
  /** "on" = only works on the website, "off" = only works not on it. */
  web?: string;
  page?: string;
  sort?: string;
  dir?: string;
  error?: string;
};

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  // The URL as the shared resolver and the exports read it. The sort is null
  // only while a search ranks by relevance with no column chosen.
  const params = new URLSearchParams(strip(sp));
  const order = inventoryOrder(params, SCREEN_ORDER);
  const supabase = await getSupabase();

  const [{ data: categories }, { data: locations }, { data: pieceLists }, { data: flagRows }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order").order("name"),
    supabase.from("locations").select("id, code, name").order("sort_order").order("code"),
    supabase.from("piece_lists").select("id, name").order("sort_order").order("name"),
    // The current user's temporary flags (RLS scopes the table to them).
    supabase.from("piece_flags").select("piece_id"),
  ]);
  const flaggedIds = new Set(((flagRows ?? []) as { piece_id: string }[]).map((f) => f.piece_id));
  const locNameById = new Map(
    ((locations ?? []) as { id: string; name: string | null; code: string }[]).map((l) => [
      l.id,
      l.name ?? l.code,
    ]),
  );

  const q = sp.q?.trim();
  const searching = Boolean(q);

  // Non-JvdB works are real stock in every practical sense, but they are the
  // exception — so the list opens on JvdB stock and the register filter is what
  // reveals the rest.
  const ledgerFilter: "jvb" | "external" | null =
    sp.ledger === "all" ? null : sp.ledger === "external" ? "external" : "jvb";

  // Save the current search + facets as a dynamic (saved-view) list. The rules
  // are stored on piece_lists.filter_rules; the list detail page re-runs them
  // live, so the membership always reflects the current inventory.
  async function saveAsList(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const rules = {
      q: String(formData.get("q") ?? "").trim() || null,
      status: String(formData.get("status") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      ledger: String(formData.get("ledger") ?? "").trim() || null,
    };
    const { data: created } = await db
      .from("piece_lists")
      .insert({ name, is_dynamic: true, filter_rules: rules })
      .select("id")
      .single();
    if (created) redirect(`/inventory/lists/${created.id}`);
    redirect("/inventory/lists");
  }

  type ListRow = {
    id: string;
    stock_number: string;
    legacy_stock_number: string | null;
    title: string | null;
    year: string | null;
    maker_id: string | null;
    maker_name: string | null;
    category_name: string | null;
    category_id: string | null;
    location_id: string | null;
    location_code: string | null;
    status: string;
    ledger: "jvb" | "external";
    primary_image_id: string | null;
    needs_completion: boolean | null;
    web_visible: boolean | null;
  };

  let rows: ListRow[] = [];
  let total = 0;
  let error: { message: string } | null = null;

  // A search, a list or the flags pick their works in code; the resolver is
  // shared with the three exports, so an export is exactly these rows in this
  // order. A search ranks by relevance unless a column is chosen; a list sorts
  // by the chosen column. Only the current page's rows are hydrated.
  let ids: string[] | null = null;
  try {
    ids = await resolveInventoryIds(supabase, params, order, { flaggedIds });
    if (ids) {
      total = ids.length;
      rows = await selectInventoryRows<ListRow>(
        supabase,
        ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      );
    }
  } catch (e) {
    error = { message: e instanceof Error ? e.message : "Could not load the inventory" };
  }

  // Everything else counts, sorts and pages in SQL.
  if (!ids && !error) {
    const by = order ?? SCREEN_ORDER;
    let query = supabase
      .from("vw_pieces_list")
      .select("*", { count: "exact" })
      .order(by.column, { ascending: by.ascending, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (ledgerFilter) query = query.eq("ledger", ledgerFilter);
    query = applyFacet(query, "status", sp.status);
    query = applyFacet(query, "category_id", sp.category, { nullable: true });
    query = applyFacet(query, "location_id", sp.location, { nullable: true });
    query = applyFlagFilters(query, sp);
    query = applyWebFilter(query, sp.web);

    const res = await query;
    rows = (res.data ?? []) as ListRow[];
    total = res.count ?? 0;
    error = res.error;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Maker life-dates for the displayed rows (shown after the maker's name).
  const makerIds = [
    ...new Set((rows ?? []).map((r) => r.maker_id).filter((v): v is string => Boolean(v))),
  ];
  const makerDatesById = new Map<string, string>();
  if (makerIds.length > 0) {
    const { data: makerRows } = await supabase
      .from("makers")
      .select("id, life_dates")
      .in("id", makerIds);
    for (const m of (makerRows ?? []) as { id: string; life_dates: string | null }[]) {
      if (m.life_dates) makerDatesById.set(m.id, m.life_dates);
    }
  }

  // Thumbnails: batch-sign the primary image for rows that have a processed one.
  const imageIds = (rows ?? [])
    .map((r) => r.primary_image_id)
    .filter((v): v is string => Boolean(v));
  const thumbByPiece = new Map<string, string>();
  if (imageIds.length > 0) {
    const { data: imgs } = await supabase
      .from("piece_images")
      .select("id, piece_id, storage_path_display")
      .in("id", imageIds)
      .not("storage_path_display", "is", null);
    const paths = (imgs ?? []).filter((i) => i.storage_path_display);
    if (paths.length > 0) {
      const signed = await Promise.all(
        paths.map((p) => signedThumbnail(supabase, "piece-derivatives", p.storage_path_display as string, THUMB_WIDTH)),
      );
      signed.forEach((url, i) => {
        const pieceId = paths[i]?.piece_id;
        if (pieceId && url) thumbByPiece.set(pieceId, url);
      });
    }
  }

  // Filters on screen that a live list's rules cannot hold (see saveAsList).
  const notSaved = [
    ...FLAG_FILTERS.filter(([param]) => sp[param]).map(([, , label]) => label),
    ...(sp.flagged ? ["Flagged only"] : []),
    ...(sp.list ? ["List filter"] : []),
    ...(sp.web === "on" || sp.web === "off" ? ["Website filter"] : []),
  ];

  // "1–100 of 869". A page past the end (an old link) shows the total alone.
  const first = (page - 1) * PAGE_SIZE + 1;
  const range =
    total === 0
      ? "No records"
      : rows.length === 0
        ? `${formatCount(total)} ${total === 1 ? "record" : "records"}`
        : `${formatCount(first)}–${formatCount(first + rows.length - 1)} of ${formatCount(total)}`;

  return (
    <div>
      <PageHeader
        title="Inventory"
        meta={`${formatCount(total)} ${total === 1 ? "record" : "records"}`}
        actions={
          <>
            <ButtonLink href="/inventory/lists" variant="quiet">
              Lists
            </ButtonLink>
            <ButtonLink href="/inventory/trash" variant="quiet">
              Trash
            </ButtonLink>
            {/* The exports are exactly the rows on screen, in the screen's
                order (lib/inventory-query), so the button says how many. */}
            <ExportMenu
              count={total}
              items={[
                { href: `/api/export/inventory.csv${qs(sp)}`, label: "CSV" },
                { href: `/api/export/inventory.docx${qs(sp)}`, label: "Word (DOCX)" },
                { href: `/api/export/inventory.xlsx${qs(sp)}`, label: "Excel (XLSX)" },
              ]}
            />
            {/* One rule wherever this button appears, rather than one that
                depends on the filter behind it: tap for JvdB stock, hold to
                switch it to a non-JvdB record. */}
            <NewRecordButton action={createDraftPiece} className={buttonClass({ variant: "primary" })} />
          </>
        }
      />

      <FlashNotice searchParams={sp} className="mb-4" />

      <InventoryFilters
        categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
        locations={(locations ?? []).map((l) => ({ id: l.id, name: l.name ?? l.code }))}
        lists={(pieceLists ?? []).map((l) => ({ id: l.id, name: l.name }))}
        flags={FLAG_FILTERS.map(([param, , label]) => ({ param, label }))}
        flaggedCount={flaggedIds.size}
      />

      {(() => {
        const fStatus = parseFacet(sp.status);
        const fCat = parseFacet(sp.category);
        const fLoc = parseFacet(sp.location);
        const not = (f: { exclude: boolean } | null, label: string) =>
          f?.exclude ? `Not ${label}` : label;
        const catName = (categories ?? []).find((c) => c.id === fCat?.value)?.name;
        const locMatch = (locations ?? []).find((l) => l.id === fLoc?.value);
        const locName = locMatch?.name ?? locMatch?.code;
        const listName = (pieceLists ?? []).find((l) => l.id === sp.list)?.name;
        const chips: Array<{ key: keyof Search; label: string; flag?: boolean }> = [];
        if (q) chips.push({ key: "q", label: `“${q}”` });
        if (sp.ledger === "external") chips.push({ key: "ledger", label: "Not JvdB" });
        else if (sp.ledger === "all") chips.push({ key: "ledger", label: "Both registers" });
        if (fStatus)
          chips.push({
            key: "status",
            label: not(fStatus, STATUS_LABELS[fStatus.value] ?? fStatus.value.replace(/_/g, " ")),
          });
        if (fCat && catName) chips.push({ key: "category", label: not(fCat, catName) });
        if (fLoc && locName) chips.push({ key: "location", label: not(fLoc, locName) });
        if (sp.list && listName) chips.push({ key: "list", label: `List: ${listName}` });
        if (sp.web === "on") chips.push({ key: "web", label: "On website" });
        else if (sp.web === "off") chips.push({ key: "web", label: "Not on website" });
        if (sp.flagged) chips.push({ key: "flagged", label: "Flagged only", flag: true });
        for (const [param, , label] of FLAG_FILTERS) {
          if (sp[param]) chips.push({ key: param, label });
        }
        if (chips.length === 0) return null;
        return (
          <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Active filters" role="group">
            {chips.map((chip) => (
              <Link
                key={chip.key}
                href={qs({ ...sp, [chip.key]: undefined, page: undefined }) || "/inventory"}
                className={chipClass()}
                aria-label={`Remove filter: ${chip.label}`}
                title="Remove this filter"
              >
                {chip.flag ? <FlagIcon size={14} className="text-warn" /> : null}
                {chip.label}
                <CloseIcon size={14} className="text-meta" />
              </Link>
            ))}
            <ButtonLink href="/inventory" variant="quiet" size="sm">
              Clear all
            </ButtonLink>
          </div>
        );
      })()}

      {q || sp.status || sp.category || sp.location || sp.ledger ? (
        <Panel className="mt-3">
          <form action={saveAsList}>
            <input type="hidden" name="q" value={q ?? ""} />
            <input type="hidden" name="status" value={sp.status ?? ""} />
            <input type="hidden" name="category" value={sp.category ?? ""} />
            <input type="hidden" name="location" value={sp.location ?? ""} />
            <input type="hidden" name="ledger" value={sp.ledger ?? ""} />
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="live-list-name" className="label">
                  Save these filters as a live list
                </label>
                <input
                  id="live-list-name"
                  name="name"
                  required
                  placeholder="e.g. Everything at the fair"
                  className="field field-sm w-64 max-w-full"
                />
              </div>
              <Button type="submit" size="sm" pendingLabel="Saving…">
                Save as list
              </Button>
            </div>
            <p className="mt-2 text-[12px] leading-[1.4] text-meta">
              Membership stays live: the list re-runs these filters each time you open it.
            </p>
            {/* A live list keeps the search, register and facets only, so say
                which of the screen's filters it will not carry rather than
                quietly saving a wider list than the one on screen. */}
            {notSaved.length > 0 ? (
              <p className="mt-1 text-[12px] leading-[1.4] text-warn">
                Not saved in a live list: {notSaved.join(", ")}.
              </p>
            ) : null}
          </form>
        </Panel>
      ) : null}

      {/* Paging sits above the results as well as below: on a full page of 100
          records, reaching the bottom pager means scrolling past everything you
          have already decided you don't want. */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="tabular text-[12px] leading-[1.4] text-meta">
          {range}
          {searching ? (
            order ? (
              <>
                {" · "}
                <Link
                  href={qs({ ...sp, sort: undefined, dir: undefined, page: undefined })}
                  className="link"
                >
                  Rank by relevance
                </Link>
              </>
            ) : (
              " · ranked by relevance"
            )
          ) : (
            ""
          )}
        </p>
        <Pager page={page} pages={pages} href={(p) => pageHref(sp, p)} label="Pagination, top" />
      </div>

      {error ? (
        <Notice tone="danger" className="mt-3">
          Could not load the inventory: {error.message}
        </Notice>
      ) : (
        <div className="mt-2">
          <InventoryTable
            rows={(rows ?? []).map(
              (r): InventoryRow => ({
                id: r.id,
                stock_number: r.stock_number,
                legacy_stock_number: r.legacy_stock_number,
                title: r.title,
                year: r.year ?? null,
                maker_name: r.maker_name,
                maker_dates: r.maker_id ? makerDatesById.get(r.maker_id) ?? null : null,
                category_name: r.category_name,
                location_name: r.location_id
                  ? locNameById.get(r.location_id) ?? r.location_code
                  : r.location_code,
                status: r.status,
                ledger: r.ledger,
                needs_completion: Boolean(r.needs_completion),
                flagged: flaggedIds.has(r.id),
                web_visible: Boolean(r.web_visible),
              }),
            )}
            flagTotal={flaggedIds.size}
            showingFlagged={Boolean(sp.flagged)}
            thumbs={Object.fromEntries(thumbByPiece)}
            lists={(pieceLists ?? []).map((l) => ({ id: l.id, name: l.name }))}
            locations={(locations ?? []).map((l) => ({ id: l.id, name: l.name ?? l.code }))}
          />
        </div>
      )}

      {/* justify-end so it sits under the top pager, which the count line's
          justify-between already pushes to the right edge. */}
      <Pager
        page={page}
        pages={pages}
        href={(p) => pageHref(sp, p)}
        label="Pagination, bottom"
        className="mt-4 justify-end"
      />
    </div>
  );
}

/**
 * A page of the current view, for the shared Pager above and below the
 * results: the filters and sort are kept, only `page` changes.
 */
function pageHref(sp: Search, page: number): string {
  const params = new URLSearchParams(strip(sp));
  params.set("page", String(page));
  return `?${params.toString()}`;
}

function strip(sp: Search): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => v && k !== "page"),
  ) as Record<string, string>;
}

function qs(sp: Search) {
  const s = new URLSearchParams(strip(sp)).toString();
  return s ? `?${s}` : "";
}
