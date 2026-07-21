"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditFinancials } from "@/components/edit-financials-context";

/** Small customs/import glyph shown when import VAT is folded into costs. */
function ImportVatIcon({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-1px] text-oranje" aria-label={title}>
      <title>{title}</title>
      <path d="M5 14v3.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M12 4v9" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
    </svg>
  );
}

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";
const readonly = `${field} bg-band/60`;

const CURRENCIES = ["GBP", "EUR", "USD", "CHF", "JPY"];
const round2 = (n: number) => Math.round(n * 100) / 100;
const gbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Spot rate → GBP for a currency on a date (ECB via Frankfurter). */
async function spotToGbp(cur: string, date: string | null): Promise<number | null> {
  if (cur === "GBP") return 1;
  if (!date) return null;
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/${date}?from=${cur}&to=GBP`);
    if (!r.ok) return null;
    const j = (await r.json()) as { rates?: { GBP?: number } };
    return typeof j?.rates?.GBP === "number" ? j.rates.GBP : null;
  } catch {
    return null;
  }
}

const VAT_LABELS: Record<string, string> = {
  margin_scheme: "margin scheme",
  standard: "standard",
  zero_rated: "zero rated",
  outside_scope: "outside scope",
};

export function FinancialsFields({
  defaults,
  saleHandledByJvb = null,
}: {
  defaults: Record<string, string>;
  // From pieces.sale_handled_by_jvb. When explicitly No, the work was sold by a
  // third party: the sold price is NET and no VAT is due for us.
  saleHandledByJvb?: boolean | null;
}) {
  const d = (k: string) => defaults[k] ?? "";

  // Live cross-panel state (sale-handled from Consignment, import VAT from the
  // Import panel). Falls back to the server value when no provider is present.
  const ctx = useEditFinancials();
  const saleHandled = ctx
    ? ctx.saleHandled
    : saleHandledByJvb === true
      ? "yes"
      : saleHandledByJvb === false
        ? "no"
        : "";
  const thirdParty = saleHandled === "no";
  const importType = ctx?.importType ?? "";
  const importVatGbp = ctx?.importVatGbp ?? 0;
  const numOf = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // Purchase side — the £ figure is entered by hand, except when the purchase
  // was made in GBP: then Cost £ just mirrors the purchase cost.
  const [purchaseDate, setPurchaseDate] = useState(d("purchase_date"));
  const [purchaseCost, setPurchaseCost] = useState(d("purchase_cost"));
  const [purchaseCur, setPurchaseCur] = useState(d("purchase_currency") || "GBP");
  const [costGbp, setCostGbp] = useState(d("purchase_cost_gbp"));
  const purchaseIsGbp = purchaseCur === "GBP";
  const [restorationGbp, setRestorationGbp] = useState(d("restoration_cost_gbp") || "0");
  const [otherGbp, setOtherGbp] = useState(d("other_costs_gbp") || "0");

  // Sale side — £ auto-converts from the spot rate on the sale date.
  const [soldDate, setSoldDate] = useState(d("sold_date"));
  const [soldPrice, setSoldPrice] = useState(d("sold_price"));
  const [sellCur, setSellCur] = useState(d("sell_currency") || "GBP");
  const [soldGbp, setSoldGbp] = useState(d("sold_price_gbp"));
  const [soldNote, setSoldNote] = useState<string | null>(null);
  // True while the £ figure is coming from the spot conversion; false when no
  // rate was available and the user should type the £ in by hand.
  const [autoConverted, setAutoConverted] = useState(true);

  const [vatTreatment, setVatTreatment] = useState(d("vat_treatment") || "margin_scheme");

  // When purchased in GBP, Cost £ mirrors the purchase cost automatically;
  // manual entry is only needed for a foreign-currency purchase.
  useEffect(() => {
    if (purchaseIsGbp) setCostGbp(purchaseCost);
  }, [purchaseIsGbp, purchaseCost]);

  useEffect(() => {
    let cancelled = false;
    const amount = Number(soldPrice);
    if (!soldPrice || Number.isNaN(amount)) {
      setSoldGbp("");
      setSoldNote(null);
      setAutoConverted(true);
      return;
    }
    const t = setTimeout(async () => {
      const rate = await spotToGbp(sellCur, soldDate || null);
      if (cancelled) return;
      if (rate == null) {
        // No spot rate (no date, a future date, or the service is down). Don't
        // clobber any £ already entered — let the user type it in by hand
        // instead of blocking the sale.
        setAutoConverted(false);
        setSoldNote(
          !soldDate
            ? "Enter a sold date to convert, or type the Sold £ in by hand."
            : `No spot rate available for ${soldDate} — type the Sold £ in by hand.`,
        );
        return;
      }
      setAutoConverted(true);
      setSoldGbp(String(round2(amount * rate)));
      setSoldNote(sellCur === "GBP" ? null : `spot ${rate.toFixed(4)} on ${soldDate}`);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [soldPrice, sellCur, soldDate]);

  // VAT + net worked out from the VAT treatment. Margin scheme charges 1/6 of
  // the margin (sale − total cost); standard-rated charges 1/6 of the sale;
  // zero-rated / outside-scope charge nothing.
  // Import VAT paid: on the margin scheme it is added to costs; on standard /
  // zero-rated it is instead reclaimable input VAT (recorded for the return).
  const importVatCost = vatTreatment === "margin_scheme" && importType === "import_vat_paid" ? importVatGbp : 0;
  const reclaimableImportVat =
    importType === "import_vat_paid" && (vatTreatment === "standard" || vatTreatment === "zero_rated") ? importVatGbp : 0;

  const { totalBase, totalCost, vatDue, netAmount } = useMemo(() => {
    const base = round2(numOf(costGbp) + numOf(restorationGbp) + numOf(otherGbp));
    const total = round2(base + importVatCost);
    const sold = numOf(soldGbp);
    let vat = 0;
    // Third-party sale (sold by someone else): no VAT for us; price is net.
    if (sold > 0 && !thirdParty) {
      if (vatTreatment === "margin_scheme") vat = Math.max(0, sold - total) / 6;
      else if (vatTreatment === "standard") vat = sold / 6;
    }
    vat = round2(vat);
    return { totalBase: base, totalCost: total, vatDue: vat, netAmount: round2(sold - vat) };
  }, [costGbp, restorationGbp, otherGbp, soldGbp, vatTreatment, thirdParty, importVatCost]);

  // Publish the values other panels need (sold £, base cost, treatment).
  useEffect(() => {
    ctx?.patch({ soldGbp: numOf(soldGbp), totalCost: totalBase, vatTreatment });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soldGbp, totalBase, vatTreatment]);

  const soldNum = numOf(soldGbp);

  // Consignment: when a share % is set, work out the J.v.d.B. share £ (shown
  // next to Net of VAT £). Mirrors the Consignment panel + stock book:
  //  - third-party sale → share % of the net sold price;
  //  - J.v.d.B. sale    → share % of (sold − total cost − VAT due).
  const sharePctNum = ctx && ctx.sharePct.trim() !== "" ? Number(ctx.sharePct) : NaN;
  const onConsignment = Number.isFinite(sharePctNum) && sharePctNum > 0 && sharePctNum < 100;
  const jvbShareBase = thirdParty ? soldNum : Math.max(0, netAmount - totalCost);
  const jvbShare = onConsignment ? round2((sharePctNum / 100) * jvbShareBase) : null;

  const curOptions = CURRENCIES.map((c) => (
    <option key={c} value={c}>
      {c}
    </option>
  ));

  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Purchase */}
        <label className={label}>
          Purchase date
          <input type="date" name="purchase_date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Purchase cost
          <input type="number" step="0.01" name="purchase_cost" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Currency
          <select name="purchase_currency" value={purchaseCur} onChange={(e) => setPurchaseCur(e.target.value)} className={field}>
            {curOptions}
          </select>
        </label>
        <label className={label}>
          Cost £
          <input
            type="number"
            step="0.01"
            name="purchase_cost_gbp"
            value={costGbp}
            readOnly={purchaseIsGbp}
            onChange={purchaseIsGbp ? undefined : (e) => setCostGbp(e.target.value)}
            className={purchaseIsGbp ? readonly : field}
          />
          <span className="mt-1 block text-[10.5px] text-ink-soft">
            {purchaseIsGbp ? "Same as purchase cost (GBP)." : "Entered manually."}
          </span>
        </label>

        <label className={label}>
          Restoration £
          <input type="number" step="0.01" name="restoration_cost_gbp" value={restorationGbp} onChange={(e) => setRestorationGbp(e.target.value)} className={field} />
        </label>
        <label className={label}>
          <span className="inline-flex items-center gap-1">
            Other costs £
            {importVatCost > 0 ? <ImportVatIcon title={`Includes import VAT of ${gbp(importVatCost)} added to costs (margin scheme)`} /> : null}
          </span>
          <input type="number" step="0.01" name="other_costs_gbp" value={otherGbp} onChange={(e) => setOtherGbp(e.target.value)} className={field} />
          {importVatCost > 0 ? (
            <span className="mt-1 block text-[10.5px] text-oranje">+ import VAT {gbp(importVatCost)}</span>
          ) : null}
        </label>
        <label className={`${label} sm:col-span-2`}>
          Marked price £
          <input type="number" step="1" name="marked_price_gbp" defaultValue={d("marked_price_gbp")} className={field} />
        </label>

        {/* Sale */}
        <label className={label}>
          Sold date
          <input type="date" name="sold_date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} className={field} />
        </label>
        <label className={label}>
          {thirdParty ? "Net sold price" : "Sold price"}
          <input type="number" step="0.01" name="sold_price" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Sell currency
          <select name="sell_currency" value={sellCur} onChange={(e) => setSellCur(e.target.value)} className={field}>
            {curOptions}
          </select>
        </label>
        <label className={label}>
          {thirdParty ? "Net sold £" : "Sold £"}
          <input
            type="number"
            step="0.01"
            name="sold_price_gbp"
            value={soldGbp}
            readOnly={autoConverted}
            onChange={autoConverted ? undefined : (e) => setSoldGbp(e.target.value)}
            className={autoConverted ? readonly : field}
          />
          {soldNote ? <span className="mt-1 block text-[10.5px] text-ink-soft">{soldNote}</span> : null}
        </label>

        <label className={`${label} sm:col-span-2`}>
          VAT treatment
          <select name="vat_treatment" value={vatTreatment} onChange={(e) => setVatTreatment(e.target.value)} className={field}>
            {Object.entries(VAT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Worked-out tax + net — display only, driven by the VAT treatment. */}
      <div className={`mt-4 grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-band/50 p-4 ${onConsignment ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <div>
          <p className={label}>Total cost £</p>
          <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(totalCost)}</p>
        </div>
        <div>
          <p className={label}>VAT due £</p>
          <p className="mt-1 font-mono text-[15px] text-ink-strong">
            {soldNum > 0 ? gbp(vatDue) : "—"}
          </p>
          <p className="mt-0.5 text-[10.5px] text-ink-soft">
            {thirdParty
              ? "no VAT — sold by a third party"
              : vatTreatment === "margin_scheme"
                ? "1/6 of margin (sale − total cost)"
                : vatTreatment === "standard"
                  ? "1/6 of sale price"
                  : "no VAT on this treatment"}
          </p>
        </div>
        <div>
          <p className={label}>Net of VAT £</p>
          <p className="mt-1 font-mono text-[15px] text-ink-strong">
            {soldNum > 0 ? gbp(netAmount) : "—"}
          </p>
          {reclaimableImportVat > 0 ? (
            <p className="mt-1 text-[10.5px] font-medium text-oranje">
              Import VAT of {gbp(reclaimableImportVat)} is reclaimable on this item — noted in the stock book.
            </p>
          ) : null}
        </div>
        {onConsignment ? (
          <div>
            <p className={label}>J.v.d.B. share £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">
              {soldNum > 0 ? gbp(jvbShare ?? 0) : "—"}
            </p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">
              {sharePctNum}%{thirdParty ? " of net sold price" : " of net after costs + VAT"} · on consignment
            </p>
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[11.5px] text-ink-soft">
        The sale £ is worked out automatically from the spot rate on the sale date (or typed
        in by hand if no rate is available); the purchase £ is entered by hand. VAT and net
        update from the VAT treatment above and are shown for reference — they aren’t stored.
      </p>
    </div>
  );
}
