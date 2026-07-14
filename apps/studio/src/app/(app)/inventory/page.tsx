import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { StatusPill } from "@/components/status-pill";
import { SortHeader } from "@/components/sort-header";

const PAGE_SIZE = 100;

// Columns the user may sort by → the underlying view column.
const SORTABLE: Record<string, string> = {
  stock_number: "stock_number",
  title: "title",
  maker_name: "maker_name",
  category_name: "category_name",
  location_code: "location_code",
  status: "status",
};

type Search = {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const sortCol = SORTABLE[sp.sort ?? ""] ?? "stock_number";
  const ascending = sp.dir === "asc";
  const supabase = await getSupabase();

  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("locations").select("id, code").order("code"),
  ]);

  const q = sp.q?.trim();
  const searching = Boolean(q);

  type ListRow = {
    id: string;
    stock_number: string;
    legacy_stock_number: string | null;
    title: string | null;
    maker_name: string | null;
    category_name: string | null;
    category_id: string | null;
    location_id: string | null;
    location_code: string | null;
    status: string;
    primary_image_id: string | null;
  };

  let rows: ListRow[] = [];
  let total = 0;
  let error: { message: string } | null = null;

  if (searching) {
    // Ranked omnisearch: FTS (weighted tsvector) + pg_trgm fuzzy + maker-name
    // matching, all in the pieces_search() RPC. Facets are applied to the
    // ranked hits, then only the current page's ids are hydrated through
    // vw_pieces_list (keeps the request URL short and preserves rank order).
    const { data: hits, error: rpcErr } = await supabase.rpc("pieces_search", {
      q,
    });
    error = rpcErr;
    let filtered = (hits ?? []) as Array<{
      id: string;
      status: string;
      category_id: string | null;
      location_id: string | null;
    }>;
    if (sp.status) filtered = filtered.filter((h) => h.status === sp.status);
    if (sp.category)
      filtered = filtered.filter((h) => h.category_id === sp.category);
    if (sp.location)
      filtered = filtered.filter((h) => h.location_id === sp.location);

    total = filtered.length;
    const pageIds = filtered
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((h) => h.id);

    if (pageIds.length > 0) {
      const { data: viewRows, error: vErr } = await supabase
        .from("vw_pieces_list")
        .select("*")
        .in("id", pageIds);
      error = error ?? vErr;
      const byId = new Map(
        ((viewRows ?? []) as ListRow[]).map((r) => [r.id, r]),
      );
      rows = pageIds
        .map((id) => byId.get(id))
        .filter((r): r is ListRow => Boolean(r));
    }
  } else {
    let query = supabase
      .from("vw_pieces_list")
      .select("*", { count: "exact" })
      .order(sortCol, { ascending, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (sp.status) query = query.eq("status", sp.status);
    if (sp.category) query = query.eq("category_id", sp.category);
    if (sp.location) query = query.eq("location_id", sp.location);

    const res = await query;
    rows = (res.data ?? []) as ListRow[];
    total = res.count ?? 0;
    error = res.error;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
      const { data: signed } = await supabase.storage
        .from("piece-derivatives")
        .createSignedUrls(
          paths.map((p) => p.storage_path_display as string),
          3600,
        );
      (signed ?? []).forEach((s, i) => {
        const pieceId = paths[i]?.piece_id;
        if (pieceId && s.signedUrl) thumbByPiece.set(pieceId, s.signedUrl);
      });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/inventory.csv${qs(sp)}`}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export CSV
          </a>
          <a
            href={`/api/export/inventory.xlsx${qs(sp)}`}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export XLSX
          </a>
          <Link
            href="/inventory/new"
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg"
          >
            New record
          </Link>
        </div>
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-2" method="get">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search stock no., title, maker…"
          className="w-full min-w-0 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] sm:w-72"
        />
        {sp.sort ? <input type="hidden" name="sort" value={sp.sort} /> : null}
        {sp.dir ? <input type="hidden" name="dir" value={sp.dir} /> : null}
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
        >
          <option value="">All statuses</option>
          {["in_stock", "reserved", "consigned_in", "consigned_out", "sold", "gifted", "returned", "written_off"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          name="category"
          defaultValue={sp.category ?? ""}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="location"
          defaultValue={sp.location ?? ""}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
        >
          <option value="">All locations</option>
          {(locations ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.code}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] font-medium text-ink-mid"
        >
          Filter
        </button>
      </form>

      {(() => {
        const catName = (categories ?? []).find((c) => c.id === sp.category)?.name;
        const locCode = (locations ?? []).find((l) => l.id === sp.location)?.code;
        const chips: Array<{ key: keyof Search; label: string }> = [];
        if (q) chips.push({ key: "q", label: `“${q}”` });
        if (sp.status) chips.push({ key: "status", label: sp.status.replace(/_/g, " ") });
        if (sp.category && catName) chips.push({ key: "category", label: catName });
        if (sp.location && locCode) chips.push({ key: "location", label: locCode });
        if (chips.length === 0) return null;
        return (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <a
                key={chip.key}
                href={qs({ ...sp, [chip.key]: undefined, page: undefined }) || "/inventory"}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-control bg-control px-2.5 py-1 text-[11.5px] text-ink-mid hover:text-ink-strong"
                title={`Remove ${chip.key} filter`}
              >
                {chip.label}
                <span aria-hidden className="text-ink-faint">
                  ×
                </span>
              </a>
            ))}
            <a
              href="/inventory"
              className="px-1.5 text-[11.5px] text-ink-soft underline hover:text-ink-strong"
            >
              Clear all
            </a>
          </div>
        );
      })()}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
        {total.toLocaleString("en-GB")} records · page {page} of {pages}
        {searching ? " · ranked by relevance" : ""}
      </p>

      {error ? (
        <p className="mt-4 text-[13px] text-ink-body">Could not load inventory: {error.message}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[820px] border-collapse bg-cell text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="w-[52px] px-3 py-2.5 font-medium" aria-label="Image" />
                <SortHeader column="stock_number" label="Stock" />
                <SortHeader column="title" label="Title" />
                <SortHeader column="maker_name" label="Maker" />
                <SortHeader column="category_name" label="Category" />
                <SortHeader column="location_code" label="Location" />
                <SortHeader column="status" label="Status" />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const thumb = thumbByPiece.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                    <td className="px-3 py-2">
                      <Link href={`/inventory/${encodeURIComponent(r.stock_number)}`}>
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="h-9 w-9 rounded-md object-cover"
                          />
                        ) : (
                          <span
                            className="jvb-hatch flex h-9 w-9 items-center justify-center rounded-md text-[11px] text-ink-soft"
                            aria-label="No image"
                          >
                            ▦
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-ink">
                      <Link href={`/inventory/${encodeURIComponent(r.stock_number)}`}>
                        {r.stock_number}
                      </Link>
                      {r.legacy_stock_number ? (
                        <span className="ml-1.5 text-ink-soft">({r.legacy_stock_number})</span>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-[13.5px] text-ink-body">
                      <Link href={`/inventory/${encodeURIComponent(r.stock_number)}`}>
                        {r.title ?? "Untitled"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-ink-muted">{r.maker_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-[13px] text-ink-muted">{r.category_name ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">{r.location_code ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                );
              })}
              {(rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                    No records match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-4 flex items-center gap-1.5 font-mono text-[12px] text-ink-muted">
          <PageLink sp={sp} page={1} disabled={page === 1} label="« First" />
          <PageLink sp={sp} page={page - 1} disabled={page === 1} label="‹ Prev" />
          <span className="px-2">
            {page} / {pages}
          </span>
          <PageLink sp={sp} page={page + 1} disabled={page === pages} label="Next ›" />
          <PageLink sp={sp} page={pages} disabled={page === pages} label="Last »" />
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({
  sp,
  page,
  disabled,
  label,
}: {
  sp: Search;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-line-soft px-2.5 py-1 text-ink-faint opacity-50">
        {label}
      </span>
    );
  }
  const params = new URLSearchParams(strip(sp));
  params.set("page", String(page));
  return (
    <Link
      href={`?${params.toString()}`}
      className="rounded-lg border border-line-control px-2.5 py-1 hover:bg-control"
    >
      {label}
    </Link>
  );
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
