"use client";

import { useState } from "react";

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
  temp_export_date: string | null;
  temp_export_reference: string | null;
  consignment_co_owner: string | null;
  consignment_notes?: string | null;
  consignment_share_pct: number | null;
  sale_handled_by_jvb: boolean | null;
  jvb_share_gbp: number | null;
  margin_gbp: number | null;
  vat_due_gbp: number | null;
};

type PreviewShipment = {
  id: string;
  shipment_date: string | null;
  reference: string | null;
  destination_country?: string | null;
};
type Preview = { import: PreviewShipment | null; export: PreviewShipment | null };

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

/**
 * The step-by-step VAT working, rebuilt from the row so the accountant can see
 * exactly how VAT due (and any J.v.d.B. share) was reached. Mirrors the SQL in
 * vw_stock_book_all: margin scheme absorbs import VAT paid; standard is 1/6 of
 * the sale; zero-rated / outside-scope carry no output VAT; a third-party sale
 * carries no VAT and settles J.v.d.B.'s share off the net sold price.
 */
function CalcSteps({ r }: { r: StockBookRow }) {
  const steps: { label: string; value: string; note?: string }[] = [];
  const treatment = r.vat_treatment ?? "margin_scheme";
  const thirdParty = r.sale_handled_by_jvb === false;
  const importVatCost =
    r.import_type === "import_vat_paid" && treatment === "margin_scheme"
      ? r.import_vat_gbp ?? 0
      : 0;

  steps.push({ label: "VAT treatment", value: TREATMENT_LABEL[treatment] ?? treatment });
  if (thirdParty)
    steps.push({
      label: "Sale handled by",
      value: "Third party",
      note: "No output VAT is due from J.v.d.B.; the figure shown is the net sold price.",
    });

  if (thirdParty) {
    steps.push({ label: "VAT due", value: gbp(0) });
  } else if (treatment === "margin_scheme") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({ label: "less total cost", value: gbp(r.total_cost_gbp ?? r.purchase_cost_gbp) });
    if (importVatCost)
      steps.push({
        label: "less import VAT paid",
        value: gbp(importVatCost),
        note: "Import VAT paid is folded into cost under the margin scheme.",
      });
    steps.push({ label: "= margin", value: gbp(r.margin_gbp) });
    steps.push({
      label: "VAT due (1/6 of positive margin)",
      value: gbp(r.vat_due_gbp),
    });
  } else if (treatment === "standard") {
    steps.push({ label: "Sold price", value: gbp(r.sold_price_gbp) });
    steps.push({ label: "VAT due (1/6 of sale)", value: gbp(r.vat_due_gbp) });
  } else {
    steps.push({
      label: "VAT due",
      value: gbp(0),
      note:
        treatment === "zero_rated"
          ? "Zero-rated supply — no output VAT."
          : "Outside the scope of UK VAT — no output VAT.",
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
      label: `J.v.d.B. share (${r.consignment_share_pct}%)`,
      value: gbp(r.jvb_share_gbp),
      note: thirdParty
        ? `${r.consignment_share_pct}% of the net sold price (third-party sale).`
        : `${r.consignment_share_pct}% of sold price less costs and VAT.`,
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

  // Fetch the import/export shipment records (with their documents) on first open.
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
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              Movement
            </h4>
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Imported</dt>
                <dd className="text-right font-mono text-ink-body">
                  {d(r.import_date)}
                  {preview?.import ? (
                    <a
                      href={`/shipments/${preview.import.id}`}
                      className="ml-2 font-sans text-[12px] text-oranje hover:underline"
                    >
                      view import doc →
                    </a>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Exported</dt>
                <dd className="text-right font-mono text-ink-body">
                  {d(r.export_date)}
                  {preview?.export?.destination_country ? (
                    <span className="ml-2 font-sans text-[12px] text-ink-soft">
                      → {preview.export.destination_country}
                    </span>
                  ) : null}
                  {preview?.export ? (
                    <a
                      href={`/shipments/${preview.export.id}`}
                      className="ml-2 font-sans text-[12px] text-oranje hover:underline"
                    >
                      view export doc →
                    </a>
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
            {r.consignment_share_pct != null ? (
              <p className="mt-3 rounded-lg border border-line-soft bg-cell px-3 py-2 text-[12px] text-ink-muted">
                Consigned{r.consignment_co_owner ? ` with ${r.consignment_co_owner}` : ""} —
                J.v.d.B. share <span className="font-medium text-ink-body">{r.consignment_share_pct}%</span>
                {r.sale_handled_by_jvb === false ? " (sale handled by third party)" : " (sale handled by J.v.d.B.)"}.
                {r.consignment_notes ? <span className="mt-1 block text-ink-soft">{r.consignment_notes}</span> : null}
              </p>
            ) : null}
          </div>

          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
              VAT working
            </h4>
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
  const [open, setOpen] = useState<string | null>(null);
  // Stock no. + (treatment) + description + purchased + purchase£ + import +
  // sold + sale£ + export + temp export + consignment + margin + VAT
  const colSpan = showTreatment ? 13 : 12;

  return (
    <>
      {rows.map((r) => {
        const isOpen = open === r.stock_number;
        return (
          <tbody key={r.stock_number}>
            <tr
              onClick={() => setOpen(isOpen ? null : r.stock_number)}
              className={`cursor-pointer border-b border-line-soft last:border-0 hover:bg-band/60 ${
                isOpen ? "bg-band/60" : ""
              }`}
            >
              <td className="px-3 py-2 font-mono text-[12px] text-ink">
                <span className="mr-1.5 inline-block w-2 text-ink-faint">{isOpen ? "▾" : "▸"}</span>
                {r.stock_number}
              </td>
              {showTreatment ? (
                <td className="px-3 py-2 text-[11.5px] text-ink-muted">
                  {TREATMENT_LABEL[r.vat_treatment ?? ""] ?? r.vat_treatment ?? "—"}
                </td>
              ) : null}
              <td className="max-w-[260px] truncate px-3 py-2 text-[13px] text-ink-body">{r.description ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-[12px] text-ink-muted">{r.purchase_date ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.purchase_cost_gbp)}</td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                {d(r.import_date)}
                {r.import_reference ? <span className="block text-ink-soft">{r.import_reference}</span> : null}
                {r.import_type ? (
                  <span className="block text-oranje">
                    {IMPORT_TYPE_LABEL[r.import_type] ?? r.import_type}
                    {r.import_vat_gbp != null ? ` ${gbp(r.import_vat_gbp)}` : ""}
                    {r.reclaimable_import_vat_gbp ? " · reclaim" : ""}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono text-[12px] text-ink-muted">{r.sold_date ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.sold_price_gbp)}</td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                {d(r.export_date)}
                {r.export_reference ? <span className="block text-ink-soft">{r.export_reference}</span> : null}
              </td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                {d(r.temp_export_date)}
                {r.temp_export_reference ? <span className="block text-ink-soft">{r.temp_export_reference}</span> : null}
              </td>
              <td className="px-3 py-2 font-mono text-[11.5px] text-ink-muted">
                {r.consignment_share_pct != null ? (
                  <>
                    <span className="block text-ink-body">
                      {r.consignment_co_owner ?? "—"} · {r.consignment_share_pct}%
                    </span>
                    <span className="block text-ink-soft">
                      {r.sale_handled_by_jvb === false ? "3rd-party" : "JvB"} · share {gbp(r.jvb_share_gbp)}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-body">{gbp(r.margin_gbp)}</td>
              <td className="px-3 py-2 text-right font-mono text-[12.5px] text-ink-strong">{gbp(r.vat_due_gbp)}</td>
            </tr>
            {isOpen ? <ExpandedRow r={r} colSpan={colSpan} /> : null}
          </tbody>
        );
      })}
    </>
  );
}
