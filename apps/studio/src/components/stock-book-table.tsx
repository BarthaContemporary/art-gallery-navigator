"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

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
const TREATMENT_LABEL: Record<string, string> = {
  margin_scheme: "Margin",
  standard: "Standard",
  zero_rated: "Zero-rated",
  outside_scope: "Outside scope",
};

function gbp(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}
function d(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString("en-GB") : "—";
}

type Col = {
  key: string;
  label: string;
  cal?: boolean; // show a small calendar glyph before the label
  align?: "left" | "right";
  width: number;
};

const MIN_W = 56;
const STORAGE_KEY = "jvb:stockbook:colwidths:v1";

/** Columns in display order. Treatment only appears on the "all items" view. */
function columns(showTreatment: boolean): Col[] {
  return [
    { key: "stock_number", label: "S.#", width: 92 },
    { key: "description", label: "Description", width: 240 },
    { key: "purchase_date", label: "Purchased", cal: true, width: 108 },
    { key: "purchase_cost_gbp", label: "Purchase £", align: "right", width: 100 },
    { key: "import", label: "Import", cal: true, width: 132 },
    { key: "export", label: "Export", cal: true, width: 132 },
    { key: "share", label: "Share", width: 128 },
    { key: "sold_date", label: "Sold", cal: true, width: 108 },
    { key: "sold_price_gbp", label: "Sale £", align: "right", width: 100 },
    { key: "margin_gbp", label: "Tax. Margin", align: "right", width: 108 },
    ...(showTreatment ? [{ key: "vat_treatment", label: "Treatment", width: 104 } as Col] : []),
    { key: "vat_due_gbp", label: "VAT due £", align: "right", width: 100 },
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
    case "margin_gbp": return r.margin_gbp;
    case "vat_treatment": return r.vat_treatment;
    case "vat_due_gbp": return r.vat_due_gbp;
    default: return null;
  }
}

function CalIcon() {
  return (
    <svg aria-hidden width="11" height="11" viewBox="0 0 16 16" fill="none" className="mr-1 inline-block align-[-1px] text-ink-faint">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon({ state }: { state: "asc" | "desc" | "none" }) {
  return (
    <svg aria-hidden width="7" height="11" viewBox="0 0 8 12" fill="none" className={`ml-0.5 inline-block ${state === "none" ? "text-ink-faint" : "text-ink-strong"}`}>
      <path d="M1.5 4.5 L4 2 L6.5 4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity={state === "desc" ? 0.3 : 1} />
      <path d="M1.5 7.5 L4 10 L6.5 7.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" opacity={state === "asc" ? 0.3 : 1} />
    </svg>
  );
}

/**
 * Step-by-step VAT working, rebuilt from the row so the accountant can see how
 * VAT due and any J.v.d.B. share were reached. Mirrors vw_stock_book_all.
 */
function CalcSteps({ r }: { r: StockBookRow }) {
  const steps: { label: string; value: string; note?: string }[] = [];
  const treatment = r.vat_treatment ?? "margin_scheme";
  const thirdParty = r.sale_handled_by_jvb === false;
  const importVatCost =
    r.import_type === "import_vat_paid" && treatment === "margin_scheme" ? r.import_vat_gbp ?? 0 : 0;

  steps.push({ label: "VAT treatment", value: TREATMENT_LABEL[treatment] ?? treatment });
  if (thirdParty)
    steps.push({ label: "Sale handled by", value: "Third party", note: "No output VAT is due from J.v.d.B." });

  if (thirdParty) {
    steps.push({ label: "VAT due", value: gbp(0) });
  } else if (treatment === "margin_scheme") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({ label: "less total cost", value: gbp(r.total_cost_gbp ?? r.purchase_cost_gbp) });
    if (importVatCost)
      steps.push({ label: "less import VAT paid", value: gbp(importVatCost), note: "Folded into cost under the margin scheme." });
    steps.push({ label: "= margin", value: gbp(r.margin_gbp) });
    steps.push({ label: "VAT due (1/6 of positive margin)", value: gbp(r.vat_due_gbp) });
  } else if (treatment === "standard") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({ label: "VAT due (1/6 of sale)", value: gbp(r.vat_due_gbp) });
  } else {
    steps.push({
      label: "VAT due",
      value: gbp(0),
      note: treatment === "zero_rated" ? "Zero-rated supply — no output VAT." : "Outside the scope of UK VAT — no output VAT.",
    });
  }

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
      note: "Share of the profit pool, plus any restoration / other costs reimbursed.",
    });
  }

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[12.5px]">
      {steps.map((s, i) => (
        <div key={i} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-ink-muted">
            {s.label}
            {s.note ? <span className="mt-0.5 block text-[11px] text-ink-soft">{s.note}</span> : null}
          </dt>
          <dd className="text-right font-mono text-ink-body">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExpandedRow({ r, colSpan }: { r: StockBookRow; colSpan: number }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  if (!preview && !loading && r.piece_id) {
    setLoading(true);
    fetch(`/api/stock-book/preview?piece=${r.piece_id}`)
      .then((res) => (res.ok ? res.json() : { import: null, export: null }))
      .then((data: Preview) => setPreview(data))
      .catch(() => setPreview({ import: null, export: null }))
      .finally(() => setLoading(false));
  }

  return (
    <tr className="border-b border-line-soft bg-band/40 last:border-0">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">Movement</h4>
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Imported</dt>
                <dd className="text-right font-mono text-ink-body">
                  {d(r.import_date)}
                  {preview?.import?.documents && preview.import.documents.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDocs(preview.import!.documents!);
                      }}
                      className="ml-2 font-sans text-[12px] text-oranje hover:underline"
                    >
                      view import doc{preview.import.documents.length > 1 ? `s (${preview.import.documents.length})` : ""} →
                    </button>
                  ) : preview?.import ? (
                    <a href={`/shipments/${preview.import.id}`} className="ml-2 font-sans text-[12px] text-oranje hover:underline">open import shipment →</a>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Exported</dt>
                <dd className="text-right font-mono text-ink-body">
                  {d(r.export_date)}
                  {preview?.export?.destination_country ? (
                    <span className="ml-2 font-sans text-[12px] text-ink-soft">→ {preview.export.destination_country}</span>
                  ) : null}
                  {preview?.export?.documents && preview.export.documents.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDocs(preview.export!.documents!);
                      }}
                      className="ml-2 font-sans text-[12px] text-oranje hover:underline"
                    >
                      view export doc{preview.export.documents.length > 1 ? `s (${preview.export.documents.length})` : ""} →
                    </button>
                  ) : preview?.export ? (
                    <a href={`/shipments/${preview.export.id}`} className="ml-2 font-sans text-[12px] text-oranje hover:underline">open export shipment →</a>
                  ) : null}
                </dd>
              </div>
              {r.temp_export_date ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">Temporary export</dt>
                  <dd className="text-right font-mono text-ink-body">{d(r.temp_export_date)}</dd>
                </div>
              ) : null}
              {r.import_type ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-muted">Import type</dt>
                  <dd className="text-right font-mono text-ink-body">
                    {IMPORT_TYPE_LABEL[r.import_type] ?? r.import_type}
                    {r.import_vat_gbp != null ? ` · ${gbp(r.import_vat_gbp)}` : ""}
                  </dd>
                </div>
              ) : null}
              {loading ? <p className="text-[11px] text-ink-soft">Loading documents…</p> : null}
            </dl>
            {r.consignment_share_pct != null
              ? (() => {
                  const treatment = r.vat_treatment ?? "margin_scheme";
                  const extraCosts = Math.max(0, (r.total_cost_gbp ?? r.purchase_cost_gbp ?? 0) - (r.purchase_cost_gbp ?? 0));
                  const importVatCost =
                    r.import_type === "import_vat_paid" && treatment === "margin_scheme" ? r.import_vat_gbp ?? 0 : 0;
                  const costIncurred = extraCosts + importVatCost;
                  return (
                    <dl className="mt-3 space-y-1.5 rounded-lg border border-line-soft bg-cell px-3 py-2 text-[12px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">J.v.d.B. share</dt>
                        <dd className="font-mono text-ink-body">{r.consignment_share_pct}%</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">Cost incurred</dt>
                        <dd className="font-mono text-ink-body">{gbp(costIncurred)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-ink-muted">Sale handled by</dt>
                        <dd className="font-mono text-ink-body">{r.sale_handled_by_jvb === false ? "Consignee" : "J.v.d.B."}</dd>
                      </div>
                    </dl>
                  );
                })()
              : null}
          </div>

          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">VAT working</h4>
            <CalcSteps r={r} />
          </div>
        </div>
      </td>
    </tr>
  );
}

export function StockBookTable({
  rows,
  showTreatment,
}: {
  rows: StockBookRow[];
  showTreatment: boolean;
}) {
  const cols = useMemo(() => columns(showTreatment), [showTreatment]);
  const defaults = useMemo(() => Object.fromEntries(cols.map((c) => [c.key, c.width])), [cols]);

  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [widths, setWidths] = useState<Record<string, number>>(defaults);

  const colRefs = useRef<Record<string, HTMLTableColElement | null>>({});
  const tableRef = useRef<HTMLTableElement | null>(null);
  const drag = useRef<{ key: string; startX: number; startW: number } | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved && typeof saved === "object") setWidths((w) => ({ ...w, ...saved }));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const widthOf = (key: string) => widths[key] ?? defaults[key] ?? 100;
  const totalWidth = () => cols.reduce((s, c) => s + widthOf(c.key), 0);

  function onHeaderClick(key: string) {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function onResizeMove(e: PointerEvent) {
    const dd = drag.current;
    if (!dd) return;
    const next = Math.max(MIN_W, dd.startW + (e.clientX - dd.startX));
    const col = colRefs.current[dd.key];
    if (col) col.style.width = `${next}px`;
    if (tableRef.current) {
      const others = cols.reduce((s, c) => s + (c.key === dd.key ? 0 : widthOf(c.key)), 0);
      tableRef.current.style.width = `${others + next}px`;
    }
  }
  function onResizeEnd(e: PointerEvent) {
    const dd = drag.current;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    drag.current = null;
    if (!dd) return;
    const next = Math.max(MIN_W, dd.startW + (e.clientX - dd.startX));
    setWidths((w) => {
      const updated = { ...w, [dd.key]: next };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }
  function onResizeStart(e: React.PointerEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { key, startX: e.clientX, startW: widthOf(key) };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  }
  function resetColumn(key: string) {
    setWidths((w) => {
      const updated = { ...w, [key]: defaults[key] ?? 100 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }
  function resetAll() {
    setWidths(defaults);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  const isCustomised = cols.some((c) => widthOf(c.key) !== c.width);

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
        (acc, r) => ({
          purchase: acc.purchase + (r.purchase_cost_gbp ?? 0),
          sold: acc.sold + (r.sold_price_gbp ?? 0),
          margin: acc.margin + (r.margin_gbp ?? 0),
          vat: acc.vat + (r.vat_due_gbp ?? 0),
          reclaim: acc.reclaim + (r.reclaimable_import_vat_gbp ?? 0),
          jvbShare: acc.jvbShare + (r.jvb_share_gbp ?? 0),
        }),
        { purchase: 0, sold: 0, margin: 0, vat: 0, reclaim: 0, jvbShare: 0 },
      ),
    [rows],
  );

  function cell(key: string, r: StockBookRow) {
    switch (key) {
      case "stock_number":
        return (
          <span className="block truncate font-mono text-[12px] text-ink">
            <span className="mr-1 inline-block w-2 text-oranje">{open === r.stock_number ? "▾" : "▸"}</span>
            {r.stock_number}
          </span>
        );
      case "description":
        return <span className="block truncate text-[13px] text-ink-body">{r.description ?? "—"}</span>;
      case "purchase_date":
        return <span className="font-mono text-[12px] text-ink-muted">{d(r.purchase_date)}</span>;
      case "purchase_cost_gbp":
        return <span className="block text-right font-mono text-[12.5px] text-ink-body">{gbp(r.purchase_cost_gbp)}</span>;
      case "import":
        return (
          <span className="font-mono text-[11.5px] text-ink-muted">
            {d(r.import_date)}
            {r.import_reference ? <span className="block truncate text-ink-soft">{r.import_reference}</span> : null}
            {r.import_type ? (
              <span className="block text-oranje">
                {IMPORT_TYPE_LABEL[r.import_type] ?? r.import_type}
                {r.import_vat_gbp != null ? ` ${gbp(r.import_vat_gbp)}` : ""}
                {r.reclaimable_import_vat_gbp ? " · reclaim" : ""}
              </span>
            ) : null}
          </span>
        );
      case "export":
        return (
          <span className="font-mono text-[11.5px] text-ink-muted">
            {d(r.export_date)}
            {r.export_reference ? <span className="block truncate text-ink-soft">{r.export_reference}</span> : null}
            {r.export_destination ? <span className="block truncate text-ink-body">→ {r.export_destination}</span> : null}
          </span>
        );
      case "share":
        return r.consignment_share_pct != null ? (
          <span className="font-mono text-[11.5px] text-ink-muted">
            <span className="block text-ink-body">{r.consignment_share_pct}%</span>
            <span className="block text-ink-soft">
              {r.sale_handled_by_jvb === false ? "3rd-party" : "JvB"} · {gbp(r.jvb_share_gbp)}
            </span>
          </span>
        ) : (
          <span className="text-ink-soft">—</span>
        );
      case "sold_date":
        return <span className="font-mono text-[12px] text-ink-muted">{d(r.sold_date)}</span>;
      case "sold_price_gbp":
        return <span className="block text-right font-mono text-[12.5px] text-ink-body">{gbp(r.sold_price_gbp)}</span>;
      case "margin_gbp":
        return <span className="block text-right font-mono text-[12.5px] text-ink-body">{gbp(r.margin_gbp)}</span>;
      case "vat_treatment":
        return <span className="text-[11.5px] text-ink-muted">{TREATMENT_LABEL[r.vat_treatment ?? ""] ?? r.vat_treatment ?? "—"}</span>;
      case "vat_due_gbp":
        return <span className="block text-right font-mono text-[12.5px] text-ink-strong">{gbp(r.vat_due_gbp)}</span>;
      default:
        return null;
    }
  }

  function footCell(key: string) {
    switch (key) {
      case "description":
        return `Totals · ${rows.length} items`;
      case "purchase_cost_gbp":
        return <span className="block text-right">{gbp(totals.purchase)}</span>;
      case "sold_price_gbp":
        return <span className="block text-right">{gbp(totals.sold)}</span>;
      case "margin_gbp":
        return <span className="block text-right">{gbp(totals.margin)}</span>;
      case "vat_due_gbp":
        return <span className="block text-right">{gbp(totals.vat)}</span>;
      case "import":
        return totals.reclaim > 0 ? <span className="font-mono text-[11px] text-oranje">reclaim {gbp(totals.reclaim)}</span> : null;
      case "share":
        return totals.jvbShare > 0 ? <span className="font-mono text-[11px] text-ink-soft">{gbp(totals.jvbShare)}</span> : null;
      default:
        return null;
    }
  }

  return (
    <div>
      {isCustomised ? (
        <div className="mb-1.5 flex justify-end">
          <button type="button" onClick={resetAll} className="text-[11.5px] text-ink-soft underline hover:text-ink-strong">
            Reset column widths
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-[11px] border border-line">
        <table ref={tableRef} style={{ width: totalWidth(), tableLayout: "fixed" }} className="min-w-full border-collapse bg-cell text-left">
          <colgroup>
            {cols.map((c) => (
              <col
                key={c.key}
                ref={(el) => {
                  colRefs.current[c.key] = el;
                }}
                style={{ width: widthOf(c.key) }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              {cols.map((c) => {
                const isActive = sort?.key === c.key;
                return (
                  <th key={c.key} className={`relative select-none px-3 py-2.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>
                    <button
                      type="button"
                      onClick={() => onHeaderClick(c.key)}
                      title="Click to sort · click again to reverse"
                      className={`inline-flex items-center gap-0.5 select-none hover:text-ink-mid ${isActive ? "text-ink-strong" : ""}`}
                    >
                      {c.cal ? <CalIcon /> : null}
                      {c.label}
                      <SortIcon state={isActive ? sort!.dir : "none"} />
                    </button>
                    <span
                      onPointerDown={(e) => onResizeStart(e, c.key)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        resetColumn(c.key);
                      }}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${c.label} column`}
                      title="Drag to resize · double-click to reset"
                      className="group absolute inset-y-0 right-0 z-20 w-4 cursor-col-resize touch-none"
                    >
                      <span className="pointer-events-none absolute inset-y-[5px] right-0 w-[2px] rounded bg-line-control transition-colors group-hover:bg-oranje" />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isOpen = open === r.stock_number;
              return (
                <Fragment key={r.stock_number}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.stock_number)}
                    className={`cursor-pointer border-b border-line-soft hover:bg-band/60 ${isOpen ? "bg-band/60" : ""}`}
                  >
                    {cols.map((c) => (
                      <td key={c.key} className="overflow-hidden px-3 py-2 align-top">
                        {cell(c.key, r)}
                      </td>
                    ))}
                  </tr>
                  {isOpen ? <ExpandedRow r={r} colSpan={cols.length} /> : null}
                </Fragment>
              );
            })}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  No records.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-band text-[12.5px] font-semibold text-ink-strong">
              {cols.map((c) => (
                <td key={c.key} className="px-3 py-2.5 font-mono">
                  {footCell(c.key)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
