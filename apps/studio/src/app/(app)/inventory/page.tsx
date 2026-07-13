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

  let query = supabase
    .from("vw_pieces_list")
    .select("*", { count: "exact" })
    .order(sortCol, { ascending, nullsFirst: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.category) query = query.eq("category_id", sp.category);
  if (sp.location) query = query.eq("location_id", sp.location);
  if (sp.q) {
    const q = sp.q.trim();
    query = query.or(
      `stock_number.ilike.%${q}%,legacy_stock_number.ilike.%${q}%,title.ilike.%${q}%,maker_name.ilike.%${q}%,medium.ilike.%${q}%`,
    );
  }

  const { data: rows, count, error } = await query;
  const total = count ?? 0;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-semibold text-ink-strong">Inventory</h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/inventory.csv${qs(sp)}`}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export CSV
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

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
        {total.toLocaleString("en-GB")} records · page {page} of {pages}
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
