import { redirect } from "next/navigation";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";

export const metadata = { title: "Stock book" };

function gbp(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export default async function StockBookPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; scheme?: string }>;
}) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) redirect("/");
  const sp = await searchParams;
  const scheme = sp.scheme === "standard" ? "standard" : "margin";
  const view = scheme === "standard" ? "vw_stock_book_standard" : "vw_stock_book";

  const supabase = await getSupabase();
  let query = supabase.from(view).select("*").order("stock_number");
  if (sp.from) query = query.gte("sold_date", sp.from);
  if (sp.to) query = query.lte("sold_date", sp.to);
  const { data: rows, error } = await query;

  const totals = (rows ?? []).reduce(
    (acc, r) => ({
      purchase: acc.purchase + (r.purchase_cost_gbp ?? 0),
      sold: acc.sold + (r.sold_price_gbp ?? 0),
      margin: acc.margin + (r.margin_gbp ?? 0),
      vat: acc.vat + (r.vat_due_gbp ?? 0),
    }),
    { purchase: 0, sold: 0, margin: 0, vat: 0 },
  );

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold text-ink-strong">Stock book</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            {scheme === "margin"
              ? "VAT margin scheme (HMRC Notice 718) — VAT due is 1/6 of the positive margin."
              : "Standard-rated items."}
          </p>
        </div>
        <a
          href={`/api/export/stock-book.csv${qs ? `?${qs}` : ""}`}
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
        >
          Export CSV
        </a>
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
            <option value="margin">Margin scheme</option>
            <option value="standard">Standard VAT</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] font-medium text-ink-mid">
          Apply
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-[13px] text-ink-body">Could not load: {error.message}</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[900px] bg-cell text-left">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-3 py-2.5 font-medium">Stock no.</th>
                <th className="px-3 py-2.5 font-medium">Description</th>
                <th className="px-3 py-2.5 font-medium">Purchased</th>
                <th className="px-3 py-2.5 text-right font-medium">Purchase £</th>
                <th className="px-3 py-2.5 font-medium">Sold</th>
                <th className="px-3 py-2.5 text-right font-medium">Sale £</th>
                <th className="px-3 py-2.5 text-right font-medium">Margin £</th>
                {scheme === "margin" ? <th className="px-3 py-2.5 text-right font-medium">VAT due £</th> : null}
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => (
                <tr key={r.stock_number} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2 font-mono text-[12px] text-ink">{r.stock_number}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-[13px] text-ink-body">{r.description ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-muted">{r.purchase_date ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.purchase_cost_gbp)}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-muted">{r.sold_date ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.sold_price_gbp)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.margin_gbp)}</td>
                  {scheme === "margin" ? (
                    <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-strong">{gbp(r.vat_due_gbp)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-band text-[12.5px] font-semibold text-ink-strong">
                <td className="px-3 py-2.5" colSpan={3}>
                  Totals ({(rows ?? []).length} items)
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{gbp(totals.purchase)}</td>
                <td />
                <td className="px-3 py-2.5 text-right font-mono">{gbp(totals.sold)}</td>
                <td className="px-3 py-2.5 text-right font-mono">{gbp(totals.margin)}</td>
                {scheme === "margin" ? <td className="px-3 py-2.5 text-right font-mono">{gbp(totals.vat)}</td> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
