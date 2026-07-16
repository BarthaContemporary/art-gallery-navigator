"use client";

import { useEffect, useState } from "react";

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field =
  "mt-1.5 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[14px] text-ink";
const readonly = `${field} bg-band/60`;

const CURRENCIES = ["GBP", "EUR", "USD", "CHF", "JPY"];
const round2 = (n: number) => Math.round(n * 100) / 100;

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

export function FinancialsFields({ defaults }: { defaults: Record<string, string> }) {
  const d = (k: string) => defaults[k] ?? "";

  const [purchaseDate, setPurchaseDate] = useState(d("purchase_date"));
  const [purchaseCost, setPurchaseCost] = useState(d("purchase_cost"));
  const [purchaseCur, setPurchaseCur] = useState(d("purchase_currency") || "GBP");
  const [costGbp, setCostGbp] = useState(d("purchase_cost_gbp"));
  const [costNote, setCostNote] = useState<string | null>(null);

  const [soldDate, setSoldDate] = useState(d("sold_date"));
  const [soldPrice, setSoldPrice] = useState(d("sold_price"));
  const [sellCur, setSellCur] = useState(d("sell_currency") || "GBP");
  const [soldGbp, setSoldGbp] = useState(d("sold_price_gbp"));
  const [soldNote, setSoldNote] = useState<string | null>(null);

  // Recompute £ whenever amount / currency / date change.
  useEffect(() => {
    let cancelled = false;
    const amount = Number(purchaseCost);
    if (!purchaseCost || Number.isNaN(amount)) {
      setCostGbp("");
      setCostNote(null);
      return;
    }
    const t = setTimeout(async () => {
      const rate = await spotToGbp(purchaseCur, purchaseDate || null);
      if (cancelled) return;
      if (rate == null) {
        setCostNote(purchaseCur === "GBP" ? null : "Enter a purchase date to convert.");
        return;
      }
      setCostGbp(String(round2(amount * rate)));
      setCostNote(purchaseCur === "GBP" ? null : `spot ${rate.toFixed(4)} on ${purchaseDate}`);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [purchaseCost, purchaseCur, purchaseDate]);

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
          <input type="number" step="0.01" name="purchase_cost_gbp" value={costGbp} readOnly className={readonly} />
          {costNote ? <span className="mt-1 block text-[10.5px] text-ink-soft">{costNote}</span> : null}
        </label>

        <label className={label}>
          Restoration £
          <input type="number" step="0.01" name="restoration_cost_gbp" defaultValue={d("restoration_cost_gbp") || 0} className={field} />
        </label>
        <label className={label}>
          Other costs £
          <input type="number" step="0.01" name="other_costs_gbp" defaultValue={d("other_costs_gbp") || 0} className={field} />
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
          <select name="vat_treatment" defaultValue={d("vat_treatment") || "margin_scheme"} className={field}>
            {["margin_scheme", "standard", "zero_rated", "outside_scope"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-[11.5px] text-ink-soft">
        £ is worked out automatically from the spot exchange rate on the purchase / sale
        date. Non-GBP amounts need a date to convert.
      </p>
    </div>
  );
}
