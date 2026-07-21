import { redirect } from "next/navigation";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";
import { StockBookTable, type StockBookRow } from "@/components/stock-book-table";

export const metadata = { title: "Stock book" };

export default async function StockBookPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; scheme?: string }>;
}) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) redirect("/");
  const sp = await searchParams;
  // Default to "all" so every item is in the stock book; the per-scheme views
  // remain available for the formal HMRC reports.
  const scheme = ["margin", "standard", "zero_rated", "outside_scope"].includes(sp.scheme ?? "")
    ? (sp.scheme as "margin" | "standard" | "zero_rated" | "outside_scope")
    : "all";
  const view =
    scheme === "standard"
      ? "vw_stock_book_standard"
      : scheme === "zero_rated"
        ? "vw_stock_book_zero_rated"
        : scheme === "outside_scope"
          ? "vw_stock_book_outside_scope"
          : scheme === "margin"
            ? "vw_stock_book"
            : "vw_stock_book_all";

  const supabase = await getSupabase();
  let query = supabase.from(view).select("*").order("stock_number");
  if (sp.from) query = query.gte("sold_date", sp.from);
  if (sp.to) query = query.lte("sold_date", sp.to);
  const { data: rows, error } = await query;

  const showTreatment = scheme === "all";

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink-muted">
            {scheme === "margin"
              ? "VAT margin scheme (HMRC Notice 718) — VAT due is 1/6 of the positive margin."
              : scheme === "zero_rated"
                ? "Zero-rated items — no output VAT; import VAT paid is reclaimable."
                : scheme === "standard"
                  ? "Standard-rated items."
                  : scheme === "outside_scope"
                    ? "Outside the scope of UK VAT — no output VAT; import VAT paid is reclaimable."
                    : "All items — VAT worked out per each item’s treatment."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/export/stock-book.csv${qs ? `?${qs}` : ""}`}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export CSV
          </a>
          <a
            href={`/api/export/stock-book.xlsx${qs ? `?${qs}` : ""}`}
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export XLSX
          </a>
        </div>
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Sold from
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Sold to
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Scheme
          <select name="scheme" defaultValue={scheme} className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]">
            <option value="all">All items</option>
            <option value="margin">Margin scheme</option>
            <option value="standard">Standard VAT</option>
            <option value="zero_rated">Zero-rated</option>
            <option value="outside_scope">Outside scope</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] font-medium text-ink-mid">
          Apply
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-[13px] text-ink-body">Could not load: {error.message}</p>
      ) : (
        <div className="mt-5">
          <StockBookTable rows={(rows ?? []) as unknown as StockBookRow[]} showTreatment={showTreatment} />
        </div>
      )}
    </div>
  );
}
