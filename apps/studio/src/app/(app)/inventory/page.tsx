import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { StatusPill } from "@/components/status-pill";

const PAGE_SIZE = 50;

type Search = {
  q?: string;
  status?: string;
  category?: string;
  location?: string;
  page?: string;
};

export const metadata = { title: "Inventory" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const supabase = await getSupabase();

  const [{ data: categories }, { data: locations }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("locations").select("id, code").order("code"),
  ]);

  let query = supabase
    .from("vw_pieces_list")
    .select("*", { count: "exact" })
    .order("stock_number", { ascending: false })
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
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid"
        >
          <option value="">All statuses</option>
          {[
            "in_stock",
            "reserved",
            "consigned_in",
            "consigned_out",
            "sold",
            "gifted",
            "returned",
            "written_off",
          ].map((s) => (
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
        {total.toLocaleString("en-GB")} records
      </p>

      {error ? (
        <p className="mt-4 text-[13px] text-ink-body">
          Could not load inventory: {error.message}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[720px] border-collapse bg-cell text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Stock</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Maker</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-control">
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
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                    {r.location_code ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
              {(rows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                    No records match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-4 flex items-center gap-2 font-mono text-[12px] text-ink-muted">
          {page > 1 ? (
            <Link className="rounded-lg border border-line-control px-2.5 py-1" href={`?${new URLSearchParams({ ...strip(sp), page: String(page - 1) })}`}>
              ‹ Prev
            </Link>
          ) : null}
          <span>
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link className="rounded-lg border border-line-control px-2.5 py-1" href={`?${new URLSearchParams({ ...strip(sp), page: String(page + 1) })}`}>
              Next ›
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

function strip(sp: Search): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => v && k !== "page"),
  ) as Record<string, string>;
}

function qs(sp: Search) {
  const params = new URLSearchParams(strip(sp));
  const s = params.toString();
  return s ? `?${s}` : "";
}
