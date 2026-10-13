"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDate, gbpExact } from "@/lib/format";
import { VAT_TREATMENT_LABELS, labelOf } from "@/lib/labels";
import { ColumnResizer, EmptyRow, SortMark, Table, TableFrame, Td, Tr, type SortState } from "@/components/ui/table";
import { cx } from "@/components/ui/cx";
import { Panel } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { ChevronDownIcon, ChevronRightIcon, ExternalIcon } from "@/components/ui/icons";
import { useResizableColumns } from "@/hooks/use-resizable-columns";

export type StockBookRow = {
  piece_id: string | null;
  stock_number: string;
  vat_treatment: string | null;
  description: string | null;
  purchase_date: string | null;
  purchase_cost_gbp: number | null;
  total_cost_gbp?: number | null;
  import_date: string | null;
  import_reference: string | null;
  import_type: string | null;
  import_vat_gbp: number | null;
  reclaimable_import_vat_gbp: number | null;
  sold_date: string | null;
  sold_price_gbp: number | null;
  export_date: string | null;
  export_reference: string | null;
  export_destination: string | null;
  temp_export_date: string | null;
  temp_export_reference: string | null;
  temp_export_destination: string | null;
  consignment_co_owner: string | null;
  consignment_notes?: string | null;
  consignment_share_pct: number | null;
  sale_handled_by_jvb: boolean | null;
  jvb_share_gbp: number | null;
  margin_gbp: number | null;
  vat_due_gbp: number | null;
  seller_name?: string | null;
  purchase_invoice_document_id?: string | null;
  /** What still needs doing on this row (the page works it out); empty when nothing. */
  attention?: string[];
};

type PreviewDoc = { title: string; url: string };
type PreviewShipment = {
  id: string;
  shipment_date: string | null;
  reference: string | null;
  destination_country?: string | null;
  documents?: PreviewDoc[];
};
type Preview = { import: PreviewShipment | null; export: PreviewShipment | null };

/** Open every document for a shipment in its own tab (one user gesture). */
function openDocs(docs: PreviewDoc[]) {
  docs.forEach((d) => window.open(d.url, "_blank", "noopener,noreferrer"));
}

const IMPORT_TYPE_LABEL: Record<string, string> = {
  import_vat_paid: "VAT paid",
  import_vat_deferred: "VAT deferred",
  temporary_import: "Temp import",
};

// The accountant reads every figure here, so money stays to the penny
// ("£1,234.56", "—" when empty). The dates are `date` columns and print as the
// day they name ("12/10/2026") in any browser's time zone.
const gbp = gbpExact;
function d(s: string | null | undefined) {
  return formatDate(s, "numeric");
}

/** Only vw_stock_book_all has the column; the page fills it in for the per-scheme views. */
function treatmentOf(r: StockBookRow): string {
  return r.vat_treatment ?? "margin_scheme";
}

/**
 * Import VAT paid on a margin-scheme work is part of its cost (Notice 718), so
 * the views take it off the margin before working out VAT due. Mirrors their
 * import_vat_cost.
 */
function importVatCost(r: StockBookRow): number {
  return r.import_type === "import_vat_paid" && treatmentOf(r) === "margin_scheme" ? (r.import_vat_gbp ?? 0) : 0;
}

/**
 * The margin VAT is worked on: margin_gbp (sale less total cost) less any
 * margin-scheme import VAT. margin_gbp alone leaves that VAT in, so the
 * working's margin line did not follow from the lines above it and the
 * Tax. Margin column did not match the VAT due beside it. Display only: the
 * views' VAT figures are unchanged. Not floored at zero, so a loss still reads
 * as a loss; VAT due is 1/6 of it only when positive.
 */
function taxableMargin(r: StockBookRow): number | null {
  return r.margin_gbp == null ? null : r.margin_gbp - importVatCost(r);
}

/** A sale £ is on record. Without one there is no margin and no VAT to show. */
function hasSale(r: StockBookRow): boolean {
  return r.sold_price_gbp != null;
}

/**
 * Sold with no purchase £. The views then work the margin as if the work cost
 * nothing (or leave it empty), so the margin is not known, and nor is VAT due
 * where it is worked from the margin.
 */
function needsPurchase(r: StockBookRow): boolean {
  return hasSale(r) && r.purchase_cost_gbp == null;
}

/** VAT due follows from the cost only under the margin scheme, on a sale J.v.d.B. handled. */
function vatFromMargin(r: StockBookRow): boolean {
  return treatmentOf(r) === "margin_scheme" && r.sale_handled_by_jvb !== false;
}

/**
 * What the Tax margin and VAT due cells show (screen only; the exports keep
 * the views' figures): a figure, null ("—", nothing sold), or NEEDS_PURCHASE
 * where the figure would rest on a purchase £ nobody has entered.
 */
const NEEDS_PURCHASE = "needs-purchase" as const;
type Figure = number | null | typeof NEEDS_PURCHASE;

function marginFigure(r: StockBookRow): Figure {
  if (!hasSale(r)) return null;
  if (needsPurchase(r)) return NEEDS_PURCHASE;
  return taxableMargin(r);
}

function vatFigure(r: StockBookRow): Figure {
  if (!hasSale(r)) return null;
  if (needsPurchase(r) && vatFromMargin(r)) return NEEDS_PURCHASE;
  return r.vat_due_gbp;
}

const NEEDS_PURCHASE_TITLE =
  "No purchase £ is recorded, so this figure is not known. Enter it under Edit financials.";

function NeedsPurchaseBadge() {
  // One line in both cells: the badge measures 93px and the 112px default
  // columns leave 96px inside, so the same reason never takes two shapes side
  // by side, and the All view still fits the 1440 page.
  return (
    <Badge tone="warn" size="xs" title={NEEDS_PURCHASE_TITLE} className="whitespace-nowrap">
      Needs purchase £
    </Badge>
  );
}

function showFigure(f: Figure): ReactNode {
  return f === NEEDS_PURCHASE ? <NeedsPurchaseBadge /> : gbp(f);
}

/**
 * The sentence under the totals when they leave rows out. Every row the VAT
 * total leaves out is also left out of the margin total, so vat <= margin.
 */
function leftOutNote(margin: number, vat: number): string {
  const sold = (n: number) => `${n} sold ${n === 1 ? "item" : "items"}`;
  if (vat === margin) return `The Tax margin and VAT due totals leave out ${sold(margin)} with no purchase £.`;
  if (vat === 0) return `The Tax margin total leaves out ${sold(margin)} with no purchase £.`;
  return `The Tax margin total leaves out ${sold(margin)} with no purchase £, and the VAT due total ${vat} of them.`;
}

/** A number for sorting and adding up: the figure, or null. */
function numberOf(f: Figure): number | null {
  return typeof f === "number" ? f : null;
}

/**
 * Purchase, restoration and other costs. Only vw_stock_book_all carries
 * total_cost_gbp; elsewhere sale less margin is the same figure, where purchase
 * cost alone left restoration out of the working.
 */
function totalCost(r: StockBookRow): number | null {
  if (r.total_cost_gbp != null) return r.total_cost_gbp;
  if (r.sold_price_gbp != null && r.margin_gbp != null) return r.sold_price_gbp - r.margin_gbp;
  return r.purchase_cost_gbp;
}

/**
 * Zero-rating rests on the work having left the country, so a sold zero-rated
 * row says whether an export is on record (spec R4: the state in words).
 */
function exportOnRecord(r: StockBookRow): boolean | null {
  if (treatmentOf(r) !== "zero_rated" || !r.sold_date) return null;
  return Boolean(r.export_date || r.export_reference);
}

type Col = {
  key: string;
  label: string;
  numeric?: boolean;
  width: number;
};

const MIN_W = 56;
// Unchanged, so widths people have dragged survive the redesign.
const STORAGE_KEY = "jvb:stockbook:colwidths:v1";

/**
 * Columns in display order. Treatment only appears on the "all items" view.
 * Default widths fit every head and figure, and all twelve columns inside
 * the 1440 page (cells use 8px sides for that, see the table below).
 */
function columns(showTreatment: boolean): Col[] {
  return [
    { key: "stock_number", label: "Stock no.", width: 112 },
    { key: "description", label: "Description", width: 176 },
    { key: "purchase_date", label: "Purchased", width: 108 },
    { key: "purchase_cost_gbp", label: "Purchase £", numeric: true, width: 112 },
    { key: "import", label: "Import", width: 112 },
    { key: "export", label: "Export", width: 112 },
    { key: "share", label: "Share", width: 104 },
    { key: "sold_date", label: "Sold", width: 100 },
    { key: "sold_price_gbp", label: "Sale £", numeric: true, width: 100 },
    { key: "margin_gbp", label: "Tax margin", numeric: true, width: 112 },
    ...(showTreatment ? [{ key: "vat_treatment", label: "Treatment", width: 112 } as Col] : []),
    { key: "vat_due_gbp", label: "VAT due £", numeric: true, width: 112 },
  ];
}

// Sort value for a column (nulls sort last regardless of direction).
function sortVal(r: StockBookRow, key: string): string | number | null {
  switch (key) {
    case "stock_number": return r.stock_number;
    case "description": return r.description;
    case "purchase_date": return r.purchase_date;
    case "purchase_cost_gbp": return r.purchase_cost_gbp;
    case "import": return r.import_date;
    case "export": return r.export_date;
    case "share": return r.consignment_share_pct;
    case "sold_date": return r.sold_date;
    case "sold_price_gbp": return r.sold_price_gbp;
    case "margin_gbp": return numberOf(marginFigure(r));
    case "vat_treatment": return r.vat_treatment;
    case "vat_due_gbp": return numberOf(vatFigure(r));
    default: return null;
  }
}

/** The editor's Financials section (its id comes from the section rail). */
function financialsHref(stock: string) {
  return `/inventory/${encodeURIComponent(stock)}/edit#sec-financials`;
}

/**
 * Step-by-step VAT working, rebuilt from the row so the accountant can see how
 * VAT due and any J.v.d.B. share were reached. Mirrors vw_stock_book_all.
 */
function CalcSteps({ r }: { r: StockBookRow }) {
  const steps: { label: string; value: ReactNode; note?: string; total?: boolean }[] = [];
  const treatment = treatmentOf(r);
  const thirdParty = r.sale_handled_by_jvb === false;
  const importVat = importVatCost(r);
  const exported = exportOnRecord(r);
  // The same rule as the table's cells: "—" until there is a sale, and no
  // figure where it would rest on a missing purchase £.
  const vat = showFigure(vatFigure(r));
  const unsoldNote = hasSale(r) ? undefined : "Nothing to work out until there is a sale £.";
  const missing = needsPurchase(r);

  steps.push({ label: "VAT treatment", value: labelOf(VAT_TREATMENT_LABELS, treatment) });
  if (thirdParty)
    steps.push({ label: "Sale handled by", value: "Third party", note: "No output VAT is due from J.v.d.B." });

  if (thirdParty) {
    steps.push({ label: "VAT due", value: vat, note: unsoldNote, total: true });
  } else if (treatment === "margin_scheme") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({
      label: "less total cost",
      value: missing ? <NeedsPurchaseBadge /> : gbp(totalCost(r)),
      note: missing ? "No purchase £ is recorded for this work." : undefined,
    });
    if (importVat)
      steps.push({ label: "less import VAT paid", value: gbp(importVat), note: "Folded into cost under the margin scheme." });
    steps.push({ label: "= taxable margin", value: showFigure(marginFigure(r)) });
    steps.push({
      label: "VAT due (1/6 of positive margin)",
      value: vat,
      note: missing ? "Enter the purchase £ under Edit financials to work this out." : unsoldNote,
      total: true,
    });
  } else if (treatment === "standard") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({ label: "VAT due (1/6 of sale)", value: vat, note: unsoldNote, total: true });
  } else {
    steps.push({
      label: "VAT due",
      value: vat,
      note: hasSale(r)
        ? treatment === "zero_rated"
          ? "Zero-rated supply: no output VAT."
          : "Outside the scope of UK VAT: no output VAT."
        : unsoldNote,
      total: true,
    });
  }

  if (exported !== null)
    steps.push({
      label: "Export evidence",
      value: exported ? (
        <span className="text-ok">Export on record</span>
      ) : (
        <span className="text-warn">No export recorded</span>
      ),
      note: exported ? undefined : "Zero-rating needs the export on file. Attach the work to its export shipment.",
    });

  if (r.reclaimable_import_vat_gbp)
    steps.push({
      label: "Reclaimable import VAT",
      value: gbp(r.reclaimable_import_vat_gbp),
      note: "Import VAT paid earlier is reclaimable input VAT on this treatment.",
    });

  if (r.consignment_share_pct != null) {
    steps.push({
      label: `J.v.d.B. receives (${r.consignment_share_pct}% share)`,
      value: gbp(r.jvb_share_gbp),
      note: "Share of the profit pool, plus any restoration and other costs reimbursed.",
    });
  }

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px] leading-[1.45]">
      {steps.map((s, i) => (
        <div key={i} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-body">
            {s.label}
            {s.note ? <span className="mt-0.5 block text-[12px] leading-[1.4] text-meta">{s.note}</span> : null}
          </dt>
          <dd className={`tabular text-right ${s.total ? "font-semibold text-ink" : "text-ink"}`}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One label-and-value line of the movement list. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-body">{label}</dt>
      <dd className="tabular text-right text-ink">{children}</dd>
    </div>
  );
}

function ShipmentLinks({ ship, kind }: { ship: PreviewShipment | null | undefined; kind: "import" | "export" }) {
  if (!ship) return null;
  const docs = ship.documents ?? [];
  if (docs.length > 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openDocs(docs);
        }}
        className="link ml-2 inline-flex items-center gap-1 text-[12px]"
      >
        {kind === "import" ? "Import" : "Export"} {docs.length > 1 ? `documents (${docs.length})` : "document"}
        <ExternalIcon size={12} />
      </button>
    );
  }
  return (
    <Link href={`/shipments/${ship.id}`} className="link ml-2 text-[12px]">
      Open {kind} shipment
    </Link>
  );
}

function ExpandedRow({ r, colSpan, id }: { r: StockBookRow; colSpan: number; id: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  // The shipment documents are fetched only when a row is opened.
  useEffect(() => {
    if (!r.piece_id) return;
    let live = true;
    fetch(`/api/stock-book/preview?piece=${r.piece_id}`)
      .then((res) => (res.ok ? res.json() : { import: null, export: null }))
      .then((data: Preview) => live && setPreview(data))
      .catch(() => live && setPreview({ import: null, export: null }));
    return () => {
      live = false;
    };
  }, [r.piece_id]);
  const loading = Boolean(r.piece_id) && !preview;
  const attention = r.attention ?? [];

  return (
    <tr id={id}>
      <td colSpan={colSpan} className="border-b border-rule bg-page px-3 pb-5 pt-3">
        {attention.length > 0 ? (
          <Notice tone="warn" inline className="mb-3">
            Needs attention: {attention.join(", ")}.
          </Notice>
        ) : null}
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="label mb-2">Movement</h4>
            <dl className="space-y-2 text-[13px] leading-[1.45]">
              <Line label="Imported">
                {d(r.import_date)}
                <ShipmentLinks ship={preview?.import} kind="import" />
              </Line>
              <Line label="Exported">
                {d(r.export_date)}
                {preview?.export?.destination_country ? (
                  <span className="ml-2 text-[12px] text-body">to {preview.export.destination_country}</span>
                ) : null}
                <ShipmentLinks ship={preview?.export} kind="export" />
              </Line>
              {r.temp_export_date ? <Line label="Temporary export">{d(r.temp_export_date)}</Line> : null}
              {r.import_type ? (
                <Line label="Import type">
                  {IMPORT_TYPE_LABEL[r.import_type] ?? r.import_type}
                  {r.import_vat_gbp != null ? ` · ${gbp(r.import_vat_gbp)}` : ""}
                </Line>
              ) : null}
              {loading ? <p className="text-[12px] text-meta">Loading documents…</p> : null}
            </dl>
            {r.consignment_share_pct != null
              ? (() => {
                  const extraCosts = Math.max(0, (r.total_cost_gbp ?? r.purchase_cost_gbp ?? 0) - (r.purchase_cost_gbp ?? 0));
                  const costIncurred = extraCosts + importVatCost(r);
                  return (
                    <Panel className="mt-3">
                      <dl className="space-y-1.5 text-[13px] leading-[1.45]">
                        <Line label="J.v.d.B. share">{r.consignment_share_pct}%</Line>
                        <Line label="Cost incurred">{gbp(costIncurred)}</Line>
                        <Line label="Sale handled by">{r.sale_handled_by_jvb === false ? "Consignee" : "J.v.d.B."}</Line>
                      </dl>
                    </Panel>
                  );
                })()
              : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={financialsHref(r.stock_number)} className={buttonClass({ size: "sm" })}>
                Edit financials
              </Link>
              <Link href={`/inventory/${encodeURIComponent(r.stock_number)}`} className={buttonClass({ variant: "quiet", size: "sm" })}>
                Open record
              </Link>
            </div>
          </div>

          <Panel title="VAT working">
            <CalcSteps r={r} />
          </Panel>
        </div>
      </td>
    </tr>
  );
}

const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;

/**
 * Th's look, composed here: the resize handle has to sit beside the sort
 * button, and Th puts every child inside that button (as the inventory table
 * found too). 8px sides, like the cells below.
 */
function SortableHead({
  label,
  numeric,
  state,
  onSort,
  resizer,
}: {
  label: string;
  numeric?: boolean;
  state: SortState;
  onSort: () => void;
  resizer: ReactNode;
}) {
  return (
    <th
      scope="col"
      aria-sort={ARIA_SORT[state]}
      className={cx(
        "relative select-none whitespace-nowrap border-b border-rule-strong bg-page px-2 py-2 align-bottom text-[11.5px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-meta",
        numeric ? "text-right" : "text-left",
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className={cx("inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-ink", state !== "none" && "text-ink")}
      >
        {/* On a numeric column the mark goes first, keeping the words flush
            with the figures below. */}
        {numeric ? <SortMark state={state} /> : null}
        <span className="self-baseline">{label}</span>
        {numeric ? null : <SortMark state={state} />}
      </button>
      {resizer}
    </th>
  );
}

export function StockBookTable({
  rows,
  showTreatment,
  showReasons = false,
  emptyText = "No records.",
  emptyAction,
}: {
  rows: StockBookRow[];
  showTreatment: boolean;
  /** List each row's attention reasons under its description (the Needs attention view). */
  showReasons?: boolean;
  /** The sentence the empty table shows, and one way out of it. */
  emptyText?: string;
  emptyAction?: ReactNode;
}) {
  const cols = useMemo(() => columns(showTreatment), [showTreatment]);
  // Column widths: drag, ←/→ on a focused handle, double-click to reset;
  // remembered under STORAGE_KEY (hooks/use-resizable-columns).
  const resize = useResizableColumns(cols, { storageKey: STORAGE_KEY, minWidth: MIN_W });

  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  function onHeaderClick(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortVal(a, key);
      const bv = sortVal(b, key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    });
  }, [rows, sort]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          // The columns' own figures, so each total adds up the rows above it
          // and leaves out the ones that show "Needs purchase £".
          const margin = marginFigure(r);
          const vat = vatFigure(r);
          return {
            purchase: acc.purchase + (r.purchase_cost_gbp ?? 0),
            sold: acc.sold + (r.sold_price_gbp ?? 0),
            margin: acc.margin + (numberOf(margin) ?? 0),
            marginLeftOut: acc.marginLeftOut + (margin === NEEDS_PURCHASE ? 1 : 0),
            vat: acc.vat + (numberOf(vat) ?? 0),
            vatLeftOut: acc.vatLeftOut + (vat === NEEDS_PURCHASE ? 1 : 0),
            reclaim: acc.reclaim + (r.reclaimable_import_vat_gbp ?? 0),
            jvbShare: acc.jvbShare + (r.jvb_share_gbp ?? 0),
          };
        },
        { purchase: 0, sold: 0, margin: 0, marginLeftOut: 0, vat: 0, vatLeftOut: 0, reclaim: 0, jvbShare: 0 },
      ),
    [rows],
  );

  // A second line under a cell's value: the share split.
  const sub = "block truncate text-[12px] leading-[1.4] text-body";
  // References and destinations wrap rather than truncate: staff match the
  // customs reference against the paperwork, so all of it has to show.
  const subWrap = "block break-words text-[12px] leading-[1.4] text-body";

  function cell(key: string, r: StockBookRow, isOpen: boolean, detailId: string) {
    switch (key) {
      case "stock_number":
        return (
          <span className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={isOpen ? detailId : undefined}
              aria-label={`${isOpen ? "Hide" : "Show"} the VAT working for ${r.stock_number}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(isOpen ? null : r.stock_number);
              }}
              className="-ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center text-meta hover:text-ink"
            >
              {isOpen ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
            </button>
            <Link
              href={financialsHref(r.stock_number)}
              onClick={(e) => e.stopPropagation()}
              title="Edit this work’s financials"
              className="link-plain tabular truncate font-medium text-ink"
            >
              {r.stock_number}
            </Link>
          </span>
        );
      case "description":
        return (
          <>
            <span className="block truncate text-body" title={r.description ?? undefined}>
              {r.description ?? "—"}
            </span>
            {showReasons && (r.attention ?? []).length > 0 ? (
              <span className="block text-[12px] leading-[1.4] text-warn">{(r.attention ?? []).join(", ")}</span>
            ) : null}
          </>
        );
      case "purchase_date":
        return <span className="tabular text-body">{d(r.purchase_date)}</span>;
      case "purchase_cost_gbp":
        return <span className="text-body">{gbp(r.purchase_cost_gbp)}</span>;
      case "import":
        return (
          <span className="block min-w-0">
            <span className="tabular block text-body">{d(r.import_date)}</span>
            {r.import_reference ? <span className={subWrap} title={r.import_reference}>{r.import_reference}</span> : null}
            {r.import_type ? (
              <span className={`${subWrap} tabular`}>
                {IMPORT_TYPE_LABEL[r.import_type] ?? r.import_type}
                {r.import_vat_gbp != null ? ` ${gbp(r.import_vat_gbp)}` : ""}
              </span>
            ) : null}
            {r.reclaimable_import_vat_gbp ? <span className="block text-[12px] leading-[1.4] text-ok">Reclaimable</span> : null}
          </span>
        );
      case "export": {
        const exported = exportOnRecord(r);
        return (
          <span className="block min-w-0">
            <span className="tabular block text-body">{d(r.export_date)}</span>
            {r.export_reference ? <span className={subWrap} title={r.export_reference}>{r.export_reference}</span> : null}
            {r.export_destination ? <span className={subWrap}>to {r.export_destination}</span> : null}
            {exported === false ? <span className="block text-[12px] leading-[1.4] text-warn">No export recorded</span> : null}
          </span>
        );
      }
      case "share":
        return r.consignment_share_pct != null ? (
          <span className="block min-w-0">
            <span className="tabular block text-body">{r.consignment_share_pct}%</span>
            <span className={`${sub} tabular`} title="Who handled the sale, and J.v.d.B.’s share">
              {r.sale_handled_by_jvb === false ? "Third party" : "JvdB"} · {gbp(r.jvb_share_gbp)}
            </span>
          </span>
        ) : (
          <span className="text-body">—</span>
        );
      case "sold_date":
        return <span className="tabular text-body">{d(r.sold_date)}</span>;
      case "sold_price_gbp":
        return <span className="text-body">{gbp(r.sold_price_gbp)}</span>;
      case "margin_gbp":
        return <span className="text-body">{showFigure(marginFigure(r))}</span>;
      case "vat_treatment":
        return <span className="block truncate text-body">{r.vat_treatment ? labelOf(VAT_TREATMENT_LABELS, r.vat_treatment) : "—"}</span>;
      case "vat_due_gbp": {
        const vat = vatFigure(r);
        return <span className={vat === null ? "text-body" : "font-medium text-ink"}>{showFigure(vat)}</span>;
      }
      default:
        return null;
    }
  }

  const items = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
  // Under a total that leaves rows out, how many (the note row below says why).
  const leftOut = (n: number) =>
    n > 0 ? <span className="block text-[11.5px] font-normal text-body">{n} left out</span> : null;

  function footCell(key: string) {
    switch (key) {
      case "description":
        // On the Needs attention view these are the shown rows' sums, not the
        // period's, and the label says so.
        return showReasons ? `Totals of the ${items(rows.length)} needing attention` : `Totals · ${items(rows.length)}`;
      case "purchase_cost_gbp":
        return gbp(totals.purchase);
      case "sold_price_gbp":
        return gbp(totals.sold);
      case "margin_gbp":
        return (
          <>
            {gbp(totals.margin)}
            {leftOut(totals.marginLeftOut)}
          </>
        );
      case "vat_due_gbp":
        return (
          <>
            {gbp(totals.vat)}
            {leftOut(totals.vatLeftOut)}
          </>
        );
      case "import":
        return totals.reclaim > 0 ? <span className="text-[12px] font-normal">Reclaim {gbp(totals.reclaim)}</span> : null;
      case "share":
        return totals.jvbShare > 0 ? <span className="text-[12px] font-normal">{gbp(totals.jvbShare)}</span> : null;
      default:
        return null;
    }
  }

  return (
    <div>
      {resize.isCustomised ? (
        <div className="mb-1.5 flex justify-end">
          <button type="button" onClick={resize.resetAll} className={buttonClass({ variant: "quiet", size: "sm" })}>
            Reset column widths
          </button>
        </div>
      ) : null}

      {/* Twelve columns on 8px cell sides rather than 12, so the whole book,
          VAT due included, fits the 1440 page without scrolling sideways.
          The descendant selectors outrank the cells' own padding; top
          alignment keeps the first lines level beside two-line cells. */}
      <TableFrame bordered>
        <Table
          ref={resize.tableRef}
          style={{ width: resize.totalWidth(), tableLayout: "fixed" }}
          className="min-w-full [&_td]:px-2 [&_td]:align-top"
        >
          <colgroup>
            {cols.map((c) => (
              <col key={c.key} ref={resize.colRef(c.key)} style={{ width: resize.widthOf(c.key) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((c) => (
                <SortableHead
                  key={c.key}
                  label={c.label}
                  numeric={c.numeric}
                  state={sort?.key === c.key ? sort.dir : "none"}
                  onSort={() => onHeaderClick(c.key)}
                  resizer={<ColumnResizer {...resize.handleProps(c.key, c.label)} />}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isOpen = open === r.stock_number;
              const detailId = `sb-detail-${r.stock_number}`;
              return (
                <Fragment key={r.stock_number}>
                  <Tr
                    current={isOpen}
                    onClick={() => setOpen(isOpen ? null : r.stock_number)}
                    className="cursor-pointer"
                  >
                    {cols.map((c) => (
                      <Td key={c.key} numeric={c.numeric} className="overflow-hidden">
                        {cell(c.key, r, isOpen, detailId)}
                      </Td>
                    ))}
                  </Tr>
                  {isOpen ? <ExpandedRow r={r} colSpan={cols.length} id={detailId} /> : null}
                </Fragment>
              );
            })}
            {sorted.length === 0 ? (
              <EmptyRow colSpan={cols.length} action={emptyAction}>
                {emptyText}
              </EmptyRow>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="bg-band font-semibold text-ink">
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cx("overflow-hidden border-t border-rule-strong py-2.5", c.numeric && "tabular whitespace-nowrap text-right")}
                >
                  {footCell(c.key)}
                </td>
              ))}
            </tr>
            {totals.marginLeftOut > 0 ? (
              <tr className="bg-band">
                <td colSpan={cols.length} className="pb-2.5 pt-0 text-[12px] leading-[1.4] text-body">
                  {leftOutNote(totals.marginLeftOut, totals.vatLeftOut)}
                </td>
              </tr>
            ) : null}
          </tfoot>
        </Table>
      </TableFrame>
    </div>
  );
}
