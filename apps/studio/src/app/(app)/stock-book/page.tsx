import Link from "next/link";
import { SaveToDriveLink } from "@/components/save-to-drive";
import { redirect } from "next/navigation";
import { getSession, getSupabase, canSeeFinancials } from "@/lib/supabase";
import { StockBookTable, type StockBookRow } from "@/components/stock-book-table";
import { londonDay } from "@/lib/caldav";
import { formatCount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { SegmentedLinks, chipClass } from "@/components/ui/chips";
import { Notice } from "@/components/ui/notice";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

export const metadata = { title: "Stock book" };

type Scheme = "all" | "margin" | "standard" | "zero_rated" | "outside_scope";
type Params = { from?: string; to?: string; scheme?: string; attention?: string };

const SCHEME_NOTE: Record<Scheme, string> = {
  margin: "VAT margin scheme (HMRC Notice 718). VAT due is 1/6 of the positive margin.",
  zero_rated: "Zero-rated items. No output VAT; import VAT paid is reclaimable.",
  standard: "Standard-rated items.",
  outside_scope: "Outside the scope of UK VAT. No output VAT; import VAT paid is reclaimable.",
  all: "All items, with VAT worked out per each item’s treatment.",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** First and last day of calendar quarter q (1-4) of year y, as `date` values. */
function quarterRange(y: number, q: number): { from: string; to: string } {
  const lastMonth = q * 3;
  const lastDay = new Date(Date.UTC(y, lastMonth, 0)).getUTCDate();
  return { from: `${y}-${pad(lastMonth - 2)}-01`, to: `${y}-${pad(lastMonth)}-${pad(lastDay)}` };
}

/**
 * Why a row needs someone's attention before the books are closed (W10), in
 * the words the toggle lists. Read from the row and from the work itself:
 * the views carry no status and no missing-purchase flag.
 */
function attentionReasons(
  r: StockBookRow,
  work: { status: string | null; missing_purchase_gbp: boolean | null } | undefined,
): string[] {
  const out: string[] = [];
  if (r.sold_date && r.sold_price_gbp == null) out.push("Sold with no sale £");
  if (!r.sold_date && r.sold_price_gbp != null) out.push("Sale £ with no sale date");
  if (work?.status === "sold" && !r.sold_date) out.push("Marked sold with no sale date");
  if (work?.missing_purchase_gbp) out.push("Needs purchase £");
  // Either one is a record of where the work came from; with neither, the
  // margin-scheme entry has nothing behind it.
  if (!r.seller_name?.trim() && !r.purchase_invoice_document_id) out.push("No seller or purchase invoice");
  return out;
}

export default async function StockBookPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await getSession();
  if (!session || !canSeeFinancials(session.roles)) redirect("/");
  const sp = await searchParams;
  // Default to "all" so every item is in the stock book; the per-scheme views
  // remain available for the formal HMRC reports.
  const scheme: Scheme = ["margin", "standard", "zero_rated", "outside_scope"].includes(sp.scheme ?? "")
    ? (sp.scheme as Scheme)
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
  const attentionOnly = sp.attention === "1";

  const supabase = await getSupabase();
  let query = supabase.from(view).select("*").order("stock_number");
  if (sp.from) query = query.gte("sold_date", sp.from);
  if (sp.to) query = query.lte("sold_date", sp.to);
  // Status and the missing-purchase flag live on the work, not in the views.
  // Only sold or flagged works can raise either reason, so the read stays
  // small however long the book grows.
  const [{ data: rows, error }, { data: works }] = await Promise.all([
    query,
    supabase
      .from("vw_pieces_list")
      .select("id, status, missing_purchase_gbp")
      .or("status.eq.sold,missing_purchase_gbp.is.true"),
  ]);
  const workById = new Map(
    ((works ?? []) as { id: string; status: string | null; missing_purchase_gbp: boolean | null }[]).map((w) => [w.id, w]),
  );

  const showTreatment = scheme === "all";
  // Only the combined view has a vat_treatment column; a per-scheme view
  // implies it. Without it the table took every row for margin scheme: a
  // standard row's VAT working read as a margin working, and its taxable
  // margin would lose import VAT that is reclaimable under that treatment.
  const implied = scheme === "all" ? null : scheme === "margin" ? "margin_scheme" : scheme;
  const allRows = ((rows ?? []) as unknown as StockBookRow[]).map((r) => {
    const withTreatment = implied && r.vat_treatment == null ? { ...r, vat_treatment: implied } : r;
    return { ...withTreatment, attention: attentionReasons(r, r.piece_id ? workById.get(r.piece_id) : undefined) };
  });
  const attentionCount = allRows.filter((r) => r.attention.length > 0).length;
  const tableRows = attentionOnly ? allRows.filter((r) => r.attention.length > 0) : allRows;

  // A link to this page with some parameters changed (undefined drops one).
  const hrefWith = (patch: Partial<Params>) => {
    const next: Params = { ...sp, ...patch };
    const qs = new URLSearchParams(
      Object.entries(next).filter(([, v]) => v) as [string, string][],
    ).toString();
    return `/stock-book${qs ? `?${qs}` : ""}`;
  };

  // The exports are the formal books: the date range and scheme only. The
  // Needs attention filter is a working view and stays on the page.
  const exportQs = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => v && k !== "attention") as [string, string][],
  ).toString();

  // Period presets (W10): calendar quarters, applied at once as links. The
  // quarters are those of the year being looked at (the "from" date's), or
  // of this year.
  const today = londonDay(new Date());
  const thisYear = Number(today.slice(0, 4));
  const thisQuarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const year = sp.from && DAY.test(sp.from) ? Number(sp.from.slice(0, 4)) : thisYear;
  const isRange = (r: { from: string; to: string }) => sp.from === r.from && sp.to === r.to;
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };
  const current = !sp.from && !sp.to
    ? "all"
    : isRange(yearRange)
      ? "year"
      : ([1, 2, 3, 4].map((q) => `q${q}`).find((_, i) => isRange(quarterRange(year, i + 1))) ?? null);
  const presets = [
    ...[1, 2, 3, 4].map((q) => {
      const r = quarterRange(year, q);
      return { value: `q${q}`, label: `Q${q}`, href: hrefWith(r) };
    }),
    { value: "year", label: String(year), href: hrefWith(yearRange) },
    { value: "all", label: "All dates", href: hrefWith({ from: undefined, to: undefined }) },
  ];
  const thisQuarterRange = quarterRange(thisYear, thisQuarter);
  const onThisQuarter = isRange(thisQuarterRange);

  const rangeText =
    sp.from || sp.to
      ? `Sold ${sp.from ? `from ${formatDate(sp.from)}` : ""}${sp.from && sp.to ? " " : ""}${sp.to ? `to ${formatDate(sp.to)}` : ""}`
      : "All sale dates, unsold stock included";

  const exportCls = buttonClass({});

  return (
    <div>
      <PageHeader
        title="Stock book"
        meta={SCHEME_NOTE[scheme]}
        actions={
          <>
            <SaveToDriveLink href={`/api/export/stock-book.csv${exportQs ? `?${exportQs}` : ""}`} className={exportCls}>
              Export CSV
            </SaveToDriveLink>
            <SaveToDriveLink href={`/api/export/stock-book.xlsx${exportQs ? `?${exportQs}` : ""}`} className={exportCls}>
              Export XLSX
            </SaveToDriveLink>
          </>
        }
      />

      <div className="space-y-3">
        {/* Period: one tap applies a quarter. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="label">Period</span>
          <Link
            href={hrefWith(thisQuarterRange)}
            aria-current={onThisQuarter ? "true" : undefined}
            className={chipClass()}
          >
            This quarter
          </Link>
          <SegmentedLinks aria-label={`Sale period in ${year}`} items={presets} current={current} />
          {/* Another year: the whole of it, whose quarters the chips then offer. */}
          <span className="inline-flex items-center">
            <Link
              href={hrefWith({ from: `${year - 1}-01-01`, to: `${year - 1}-12-31` })}
              aria-label={`All of ${year - 1}`}
              className={buttonClass({ variant: "quiet", size: "sm" })}
            >
              <ChevronLeftIcon size={14} />
              {year - 1}
            </Link>
            {year < thisYear ? (
              <Link
                href={hrefWith({ from: `${year + 1}-01-01`, to: `${year + 1}-12-31` })}
                aria-label={`All of ${year + 1}`}
                className={buttonClass({ variant: "quiet", size: "sm" })}
              >
                {year + 1}
                <ChevronRightIcon size={14} />
              </Link>
            ) : null}
          </span>
        </div>

        {/* A range of one's own, or another scheme: Apply. */}
        <form method="get" className="flex flex-wrap items-end gap-2">
          {attentionOnly ? <input type="hidden" name="attention" value="1" /> : null}
          <div className="flex flex-col gap-1">
            <label htmlFor="sb-from" className="label">
              Sold from
            </label>
            <input id="sb-from" type="date" name="from" defaultValue={sp.from ?? ""} className="field w-[160px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sb-to" className="label">
              Sold to
            </label>
            <input id="sb-to" type="date" name="to" defaultValue={sp.to ?? ""} className="field w-[160px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sb-scheme" className="label">
              Scheme
            </label>
            <select id="sb-scheme" name="scheme" defaultValue={scheme} className="field w-[160px]">
              <option value="all">All items</option>
              <option value="margin">Margin scheme</option>
              <option value="standard">Standard VAT</option>
              <option value="zero_rated">Zero-rated</option>
              <option value="outside_scope">Outside scope</option>
            </select>
          </div>
          <button type="submit" className={buttonClass({})}>
            Apply
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={hrefWith({ attention: attentionOnly ? undefined : "1" })}
            aria-current={attentionOnly ? "true" : undefined}
            className={chipClass()}
            title="Sold with no sale £ or date, marked sold with no sale date, needs purchase £, or no seller or purchase invoice"
          >
            Needs attention
            <span className="chip-count">{formatCount(attentionCount)}</span>
          </Link>
          <p className="text-[12px] leading-[1.4] text-meta">
            {rangeText}
            {attentionOnly ? ` · showing the ${formatCount(attentionCount)} that need attention` : null}
          </p>
        </div>
      </div>

      {error ? (
        <Notice tone="danger" className="mt-5">
          Could not load the stock book: {error.message}
        </Notice>
      ) : (
        <div className="mt-5">
          <StockBookTable
            rows={tableRows}
            showTreatment={showTreatment}
            showReasons={attentionOnly}
            emptyText={
              attentionOnly
                ? "Nothing in this period needs attention."
                : sp.from || sp.to
                  ? "Nothing was sold in this period."
                  : "No works in the stock book yet."
            }
            emptyAction={
              attentionOnly ? (
                <Link href={hrefWith({ attention: undefined })} className={buttonClass({ size: "sm" })}>
                  Show every item
                </Link>
              ) : sp.from || sp.to ? (
                <Link href={hrefWith({ from: undefined, to: undefined })} className={buttonClass({ size: "sm" })}>
                  All dates
                </Link>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}
