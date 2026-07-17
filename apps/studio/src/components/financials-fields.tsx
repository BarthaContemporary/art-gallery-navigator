"use client";

import { useEffect, useMemo, useState } from "react";

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
    const r = await fetch(`https://api.frankfurter.app/${date}?from=${cur}&to=GBP`);
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

export function FinancialsFields({ defaults }: { defaults: Record<string, string> }) {
  const d = (k: string) => defaults[k] ?? "";
  const numOf = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  // Purchase side — the £ figure is entered manually (no spot conversion).
  const [purchaseDate, setPurchaseDate] = useState(d("purchase_date"));
  const [purchaseCost, setPurchaseCost] = useState(d("purchase_cost"));
  const [purchaseCur, setPurchaseCur] = useState(d("purchase_currency") || "GBP");
  const [costGbp, setCostGbp] = useState(d("purchase_cost_gbp"));
  const [restorationGbp, setRestorationGbp] = useState(d("restoration_cost_gbp") || "0");
  const [otherGbp, setOtherGbp] = useState(d("other_costs_gbp") || "0");

  // Sale side — £ auto-converts from the spot rate on the sale date.
  const [soldDate, setSoldDate] = useState(d("sold_date"));
  const [soldPrice, setSoldPrice] = useState(d("sold_price"));
  const [sellCur, setSellCur] = useState(d("sell_currency") || "GBP");
  const [soldGbp, setSoldGbp] = useState(d("sold_price_gbp"));
  const [soldNote, setSoldNote] = useState<string | null>(null);

  const [vatTreatment, setVatTreatment] = useState(d("vat_treatment") || "margin_scheme");

  useEffect(() => {
    let cancelled = false;
    const amount = Number(soldPrice);
    if (!soldPrice || Number.isNaN(amount)) {
      setSoldGbp("");
      setSoldNote(null);
      return;
    }
    const t = setTimeout(async () => {
      const rate = await spotToGbp(sellCur, soldDate || null);
      if (cancelled) return;
      if (rate == null) {
        setSoldNote(sellCur === "GBP" ? null : "Enter a sold date to convert.");
        return;
      }
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
  const { totalCost, vatDue, netAmount } = useMemo(() => {
    const total = round2(numOf(costGbp) + numOf(restorationGbp) + numOf(otherGbp));
    const sold = numOf(soldGbp);
    let vat = 0;
    if (sold > 0) {
      if (vatTreatment === "margin_scheme") vat = Math.max(0, sold - total) / 6;
      else if (vatTreatment === "standard") vat = sold / 6;
    }
    vat = round2(vat);
    return { totalCost: total, vatDue: vat, netAmount: round2(sold - vat) };
  }, [costGbp, restorationGbp, otherGbp, soldGbp, vatTreatment]);

  const soldNum = numOf(soldGbp);

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
          <input type="number" step="0.01" name="purchase_cost_gbp" value={costGbp} onChange={(e) => setCostGbp(e.target.value)} className={field} />
          <span className="mt-1 block text-[10.5px] text-ink-soft">Entered manually.</span>
        </label>

        <label className={label}>
          Restoration £
          <input type="number" step="0.01" name="restoration_cost_gbp" value={restorationGbp} onChange={(e) => setRestorationGbp(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Other costs £
          <input type="number" step="0.01" name="other_costs_gbp" value={otherGbp} onChange={(e) => setOtherGbp(e.target.value)} className={field} />
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
          Sold price
          <input type="number" step="0.01" name="sold_price" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Sell currency
          <select name="sell_currency" value={sellCur} onChange={(e) => setSellCur(e.target.value)} className={field}>
            {curOptions}
          </select>
        </label>
        <label className={label}>
          Sold £
          <input type="number" step="0.01" name="sold_price_gbp" value={soldGbp} readOnly className={readonly} />
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
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-band/50 p-4 sm:grid-cols-3">
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
            {vatTreatment === "margin_scheme"
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
        </div>
      </div>

      <p className="mt-3 text-[11.5px] text-ink-soft">
        The sale £ is worked out automatically from the spot rate on the sale date; the
        purchase £ is entered by hand. VAT and net update from the VAT treatment above and
        are shown for reference — they aren’t stored.
      </p>
    </div>
  );
}
