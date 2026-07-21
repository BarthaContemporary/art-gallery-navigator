"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditFinancials } from "@/components/edit-financials-context";

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field = "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";
const round2 = (n: number) => Math.round(n * 100) / 100;
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Settlement = {
  soldGbp: number | null;
  totalCostGbp: number | null;
  vatTreatment: string;
} | null;

/**
 * Consignment panel — lives below Temporary exports. Autosaves on its own
 * endpoint (partial update) so it doesn't disturb the main record form, and
 * shows a live settlement split for admin/accountant.
 *
 * Settlement rules:
 *  - Sale handled by J.v.d.B. → regular VAT applies; J.v.d.B. keeps the
 *    Share/Commission % of (sold − costs − VAT due).
 *  - Sold by a third party → no VAT for us; the sold price is NET, and
 *    J.v.d.B. receives the Share/Commission % of that net sold price.
 */
export function ConsignmentPanel({
  stockNumber,
  initial,
  settlement,
}: {
  stockNumber: string;
  initial: {
    coOwner: string;
    notes: string;
    sharePct: string;
    saleHandled: "" | "yes" | "no";
  };
  settlement: Settlement;
}) {
  const [coOwner, setCoOwner] = useState(initial.coOwner);
  const [notes, setNotes] = useState(initial.notes);
  const [sharePct, setSharePct] = useState(initial.sharePct);
  const [saleHandled, setSaleHandled] = useState<"" | "yes" | "no">(initial.saleHandled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Publish share % + sale-handled to the shared state so the Financials panel
  // relabels the sold price / zeroes VAT live.
  const ctx = useEditFinancials();
  useEffect(() => {
    ctx?.patch({ sharePct, saleHandled });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharePct, saleHandled]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  const pctNum = sharePct.trim() === "" ? null : Number(sharePct);
  const pctInvalid = pctNum !== null && (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum >= 100);

  const save = useCallback(async () => {
    if (pctInvalid) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    const body = new FormData();
    body.set("co_owner_consignee", coOwner);
    body.set("consignment_details", notes);
    body.set("consignment_share_pct", sharePct);
    body.set("sale_handled_by_jvb", saleHandled);
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(stockNumber)}/consignment`, {
        method: "PATCH",
        body,
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }, [coOwner, notes, sharePct, saleHandled, pctInvalid, stockNumber]);

  // Debounced autosave on any change (skip the initial mount).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [coOwner, notes, sharePct, saleHandled, save]);

  // Live settlement (admin/accountant only — settlement is null otherwise).
  // Sold price / costs / treatment come live from the Financials + Import
  // panels via shared state, falling back to the values passed at load.
  const liveSold = ctx?.soldGbp ?? settlement?.soldGbp ?? 0;
  const liveCosts = ctx?.totalCost ?? settlement?.totalCostGbp ?? 0;
  const liveTreatment = ctx?.vatTreatment ?? settlement?.vatTreatment ?? "margin_scheme";
  const importVatCost =
    liveTreatment === "margin_scheme" && ctx?.importType === "import_vat_paid" ? ctx?.importVatGbp ?? 0 : 0;

  const split = useMemo(() => {
    if (!settlement || pctNum === null || pctInvalid || saleHandled === "") return null;
    const sold = liveSold;
    if (sold <= 0) return null;
    const pct = pctNum / 100;
    if (saleHandled === "no") {
      // Third-party sale: no VAT, sold price is net.
      return { vat: 0, base: round2(sold), share: round2(pct * sold), thirdParty: true as const };
    }
    // JvB sale: regular VAT (margin scheme absorbs import VAT), share of the net.
    const costs = round2(liveCosts + importVatCost);
    let vat = 0;
    if (liveTreatment === "margin_scheme") vat = Math.max(0, sold - costs) / 6;
    else if (liveTreatment === "standard") vat = sold / 6;
    vat = round2(vat);
    const base = round2(sold - costs - vat);
    return { vat, base, share: round2(pct * base), thirdParty: false as const };
  }, [settlement, pctNum, pctInvalid, saleHandled, liveSold, liveCosts, liveTreatment, importVatCost]);

  const statusText =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? (pctInvalid ? "Share must be 1–99" : "Couldn’t save") : "";

  return (
    <section className="mt-4 rounded-[11px] border border-line bg-cell p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink-strong">Consignment</h2>
        <span className={`text-[11px] ${status === "error" ? "text-oranje" : "text-ink-soft"}`}>{statusText}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          Co-owner / consignee
          <input value={coOwner} onChange={(e) => setCoOwner(e.target.value)} className={field} />
        </label>

        <label className={label}>
          Share / commission (%)
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="99.99"
            value={sharePct}
            onChange={(e) => setSharePct(e.target.value)}
            className={`${field} ${pctInvalid ? "border-oranje" : ""}`}
          />
          <span className="mt-1 block text-[10.5px] text-ink-soft">
            If consigned out, add percentage received by J.v.d.B.
          </span>
        </label>

        <label className={label}>
          Sale handled by J.v.d.B.
          <select value={saleHandled} onChange={(e) => setSaleHandled(e.target.value as "" | "yes" | "no")} className={field}>
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <label className={`${label} sm:col-span-2`}>
          Consignment notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />
        </label>
      </div>

      {split ? (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-band/50 p-4 sm:grid-cols-3">
          <div>
            <p className={label}>VAT due £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{split.thirdParty ? "—" : gbp(split.vat)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">{split.thirdParty ? "no VAT (third-party sale)" : "regular VAT rules"}</p>
          </div>
          <div>
            <p className={label}>{split.thirdParty ? "Net sold price £" : "Net after costs + VAT £"}</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(split.base)}</p>
          </div>
          <div>
            <p className={label}>J.v.d.B. share £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(split.share)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">{sharePct}% of the above</p>
          </div>
        </div>
      ) : settlement && pctNum !== null && !pctInvalid && saleHandled === "" ? (
        <p className="mt-3 text-[11.5px] text-ink-soft">
          Set “Sale handled by J.v.d.B.” to work out VAT and the J.v.d.B. share.
        </p>
      ) : null}
    </section>
  );
}
