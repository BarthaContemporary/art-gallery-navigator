"use client";

import { useEffect, useMemo, useState } from "react";
import { parseAmount } from "@/lib/amount";
import { AmountInput } from "@/components/amount-input";
import { useEditFinancials } from "@/components/edit-financials-context";
import { consignmentSplit, round2, saleVat } from "@/lib/consignment";
import {
  canConvertSale,
  currencyCode,
  currencyOptions,
  londonToday,
  samePence,
  shouldConvertSale,
  type StoredSale,
} from "@/lib/fx";
import { Field } from "@/components/ui/field";
import { Panel } from "@/components/ui/section";

/** Small customs/import glyph shown when import VAT is folded into costs. */
function ImportVatIcon({ title }: { title: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-[-1px] text-body" aria-label={title}>
      <title>{title}</title>
      <path d="M5 14v3.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14" />
      <path d="M12 4v9" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
    </svg>
  );
}

const field = "field";
// Worked out, not typed: no fill, so it reads as a figure rather than a box
// to type into (the field keeps its bottom rule and stays focusable).
const readonly = "field bg-transparent text-body hover:bg-transparent";
const figure = "tabular mt-1 text-[14.5px] leading-[1.45] text-ink";
const note = "mt-0.5 text-[12px] leading-[1.4] text-meta";

const gbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isGbp = (cur: string) => currencyCode(cur) === "GBP";

/** A stored currency as the select holds it: the ISO code, or the stored text as it is. */
const selectValue = (stored: string) => currencyCode(stored) ?? (stored.trim() || "GBP");

/**
 * Spot rate → GBP for a currency on a date, from the studio's own route: the
 * same cache and rules as the save, so the Sold £ shown is the one stored.
 */
async function spotToGbp(cur: string, date: string | null): Promise<number | null> {
  const code = currencyCode(cur);
  if (!code) return null;
  if (code === "GBP") return 1;
  if (!date) return null;
  try {
    const r = await fetch(
      `/api/inventory/spot-rate?currency=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { rate?: number | null };
    return typeof j?.rate === "number" ? j.rate : null;
  } catch {
    return null;
  }
}

function noRateNote(cur: string, date: string): string {
  if (!currencyCode(cur)) return `No spot rate for ${cur}. Type the Sold £ in by hand.`;
  if (!date) return "Enter a sold date to convert, or type the Sold £ in by hand.";
  return `No spot rate available for ${date}. Type the Sold £ in by hand.`;
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
  const numOf = (s: string) => parseAmount(s) ?? 0;
  const today = useMemo(() => londonToday(), []);

  // Purchase side — the £ figure is entered by hand, except when the purchase
  // was made in GBP: then Cost £ mirrors the purchase cost. The mirror runs
  // from the edits (cost typed, currency chosen), never on load over a figure
  // on record: a GBP row whose £ differs from its cost keeps both, and its
  // Cost £ stays editable.
  const loadedPurchaseCur = selectValue(d("purchase_currency"));
  const [purchaseDate, setPurchaseDate] = useState(d("purchase_date"));
  const [purchaseCost, setPurchaseCost] = useState(d("purchase_cost"));
  const [purchaseCur, setPurchaseCur] = useState(loadedPurchaseCur);
  const loadedGbpDiffers =
    d("purchase_cost") !== "" &&
    d("purchase_cost_gbp") !== "" &&
    !samePence(parseAmount(d("purchase_cost")), parseAmount(d("purchase_cost_gbp")));
  const [mirror, setMirror] = useState(isGbp(loadedPurchaseCur) && !loadedGbpDiffers);
  // A GBP purchase with no £ yet (a GBP invoice pushed from the capture app)
  // shows its cost as the £, which the next save stores.
  const [costGbp, setCostGbp] = useState(() =>
    isGbp(loadedPurchaseCur) && d("purchase_cost_gbp") === "" ? d("purchase_cost") : d("purchase_cost_gbp"),
  );
  const purchaseIsGbp = isGbp(purchaseCur);
  const [restorationGbp, setRestorationGbp] = useState(d("restoration_cost_gbp") || "0");
  const [otherGbp, setOtherGbp] = useState(d("other_costs_gbp") || "0");

  const onPurchaseCost = (v: string) => {
    setPurchaseCost(v);
    if (mirror) setCostGbp(v);
  };
  const onPurchaseCurrency = (next: string) => {
    const wasGbp = isGbp(purchaseCur);
    const nowGbp = isGbp(next);
    setPurchaseCur(next);
    if (nowGbp && !wasGbp) {
      setMirror(true);
      setCostGbp(purchaseCost);
    } else if (!nowGbp && mirror) {
      // The £ was only the mirrored foreign amount: clear it, so the real £
      // has to be typed rather than ¥500,000 being kept as £500,000.
      setMirror(false);
      setCostGbp("");
    }
  };

  // Sale side — £ converts from the spot rate on the sale date when the
  // price, currency or date change (or nothing is on record). A recorded
  // sale's £ is shown as stored: the save keeps it too (lib/fx).
  const loadedSellCur = selectValue(d("sell_currency"));
  const loadedSale: StoredSale = useMemo(
    () => ({
      price: parseAmount(d("sold_price")),
      currency: loadedSellCur,
      date: d("sold_date") || null,
      gbp: parseAmount(d("sold_price_gbp")),
    }),
    // The loaded figures never change while the form is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [soldDate, setSoldDate] = useState(d("sold_date"));
  const [soldPrice, setSoldPrice] = useState(d("sold_price"));
  const [sellCur, setSellCur] = useState(loadedSellCur);
  const [soldGbp, setSoldGbp] = useState(d("sold_price_gbp"));
  const [soldNote, setSoldNote] = useState<string | null>(null);
  // True while the £ figure comes from the spot conversion (or the record);
  // false when no rate is available and the user should type the £ by hand.
  const [autoConverted, setAutoConverted] = useState(true);

  const [vatTreatment, setVatTreatment] = useState(d("vat_treatment") || "margin_scheme");

  const purchaseOptions = useMemo(() => currencyOptions(loadedPurchaseCur), [loadedPurchaseCur]);
  const sellOptions = useMemo(() => currencyOptions(loadedSellCur), [loadedSellCur]);

  useEffect(() => {
    let cancelled = false;
    const amount = parseAmount(soldPrice);
    if (!soldPrice || amount === null) {
      // No price, no £; a £ on record without a price (legacy) is left as
      // it is, as the save leaves it.
      setSoldGbp(loadedSale.price == null ? d("sold_price_gbp") : "");
      setSoldNote(null);
      setAutoConverted(true);
      return;
    }
    const now = { price: amount, currency: sellCur, date: soldDate || null };
    if (!shouldConvertSale(now, loadedSale, today)) {
      // A recorded sale with its inputs unchanged: its £ stands. It can be
      // typed only where no rate exists for these inputs.
      const typeable = !canConvertSale(now, today);
      setSoldGbp(d("sold_price_gbp"));
      setAutoConverted(!typeable);
      setSoldNote(
        typeable
          ? noRateNote(sellCur, soldDate)
          : isGbp(sellCur) && samePence(loadedSale.gbp, amount)
            ? null
            : "As recorded. Changing the price, currency or date converts it again.",
      );
      return;
    }
    const t = setTimeout(async () => {
      const rate = await spotToGbp(sellCur, soldDate || null);
      if (cancelled) return;
      if (rate == null) {
        // No spot rate (no date, a future date, an unknown currency, or the
        // service is down). Don't clobber any £ already entered — let the
        // user type it in by hand instead of blocking the sale.
        setAutoConverted(false);
        setSoldNote(noRateNote(sellCur, soldDate));
        return;
      }
      setAutoConverted(true);
      setSoldGbp(String(round2(amount * rate)));
      setSoldNote(isGbp(sellCur) ? null : `spot ${rate.toFixed(4)} on ${soldDate}`);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // d() reads the loaded defaults, which never change while the form is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soldPrice, sellCur, soldDate, loadedSale, today]);

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
    // Third-party sale (sold by someone else): no VAT for us; price is net.
    // In whole pence, as the stock book works it (lib/consignment).
    const vat =
      sold > 0
        ? saleVat({ amount: sold, vatTreatment, saleHandledByJvb: thirdParty ? false : null, costBaseGbp: total })
        : 0;
    return { totalBase: base, totalCost: total, vatDue: vat, netAmount: round2(sold - vat) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costGbp, restorationGbp, otherGbp, soldGbp, vatTreatment, thirdParty, importVatCost]);

  // Publish the values other panels need (sold £, purchase £, base cost, treatment).
  useEffect(() => {
    ctx?.patch({ soldGbp: numOf(soldGbp), purchaseCost: numOf(costGbp), totalCost: totalBase, vatTreatment });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soldGbp, costGbp, totalBase, vatTreatment]);

  const soldNum = numOf(soldGbp);

  // Consignment: when a share % is set, work out the J.v.d.B. share £ (shown
  // next to Net of VAT £). The purchase cost still drives the margin-scheme VAT
  // but is ignored in the shared pool; restoration / other / import VAT are
  // carried by J.v.d.B. out of its own share.
  const sharePctNum = ctx && ctx.sharePct.trim() !== "" ? (parseAmount(ctx.sharePct) ?? NaN) : NaN;
  const onConsignment = Number.isFinite(sharePctNum) && sharePctNum > 0 && sharePctNum < 100;
  const jvbSplit = onConsignment
    ? consignmentSplit({
        amount: soldNum,
        vatTreatment,
        saleHandledByJvb: saleHandled === "no" ? false : saleHandled === "yes" ? true : null,
        purchaseCostGbp: numOf(costGbp),
        extraCostsGbp: numOf(restorationGbp) + numOf(otherGbp),
        importVatPaidGbp: importType === "import_vat_paid" ? importVatGbp : 0,
        sharePct: sharePctNum,
      })
    : null;

  const options = (list: string[]) =>
    list.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ));

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Purchase */}
        <Field label="Purchase date" id="fin-purchase-date">
          <input id="fin-purchase-date" type="date" name="purchase_date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={field} />
        </Field>
        <Field label="Purchase cost" id="fin-purchase-cost">
          <AmountInput id="fin-purchase-cost" name="purchase_cost" value={purchaseCost} onChange={(e) => onPurchaseCost(e.target.value)} className={`${field} tabular`} />
        </Field>
        <Field label="Currency" id="fin-purchase-currency">
          <select id="fin-purchase-currency" name="purchase_currency" value={purchaseCur} onChange={(e) => onPurchaseCurrency(e.target.value)} className={field}>
            {options(purchaseOptions)}
          </select>
        </Field>
        <Field
          label="Cost £"
          id="fin-cost-gbp"
          hint={
            mirror
              ? "Same as purchase cost (GBP)."
              : purchaseIsGbp
                ? "Differs from the purchase cost. Check which figure is right."
                : "Entered manually."
          }
        >
          <AmountInput
            id="fin-cost-gbp"
            name="purchase_cost_gbp"
            value={costGbp}
            readOnly={mirror}
            onChange={mirror ? undefined : (e) => setCostGbp(e.target.value)}
            aria-describedby="fin-cost-gbp-hint"
            className={`${mirror ? readonly : field} tabular`}
          />
        </Field>

        <Field label="Restoration £" id="fin-restoration">
          <AmountInput id="fin-restoration" name="restoration_cost_gbp" value={restorationGbp} onChange={(e) => setRestorationGbp(e.target.value)} className={`${field} tabular`} />
        </Field>
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              Other costs £
              {importVatCost > 0 ? <ImportVatIcon title={`Includes import VAT of ${gbp(importVatCost)} added to costs (margin scheme)`} /> : null}
            </span>
          }
          id="fin-other"
          hint={importVatCost > 0 ? `Plus import VAT ${gbp(importVatCost)}` : undefined}
        >
          <AmountInput
            id="fin-other"
            name="other_costs_gbp"
            value={otherGbp}
            onChange={(e) => setOtherGbp(e.target.value)}
            aria-describedby={importVatCost > 0 ? "fin-other-hint" : undefined}
            className={`${field} tabular`}
          />
        </Field>
        <Field label="Marked price £" id="fin-marked" className="sm:col-span-2">
          <AmountInput id="fin-marked" decimals={0} name="marked_price_gbp" defaultValue={d("marked_price_gbp")} className={`${field} tabular`} />
        </Field>

        {/* Sale */}
        <Field label="Sold date" id="fin-sold-date">
          <input id="fin-sold-date" type="date" name="sold_date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)} className={field} />
        </Field>
        <Field label={thirdParty ? "Net sold price" : "Sold price"} id="fin-sold-price">
          <AmountInput id="fin-sold-price" name="sold_price" value={soldPrice} onChange={(e) => setSoldPrice(e.target.value)} className={`${field} tabular`} />
        </Field>
        <Field label="Sell currency" id="fin-sell-currency">
          <select id="fin-sell-currency" name="sell_currency" value={sellCur} onChange={(e) => setSellCur(e.target.value)} className={field}>
            {options(sellOptions)}
          </select>
        </Field>
        <Field label={thirdParty ? "Net sold £" : "Sold £"} id="fin-sold-gbp" hint={soldNote ?? undefined}>
          <AmountInput
            id="fin-sold-gbp"
            name="sold_price_gbp"
            value={soldGbp}
            readOnly={autoConverted}
            onChange={autoConverted ? undefined : (e) => setSoldGbp(e.target.value)}
            aria-describedby={soldNote ? "fin-sold-gbp-hint" : undefined}
            className={`${autoConverted ? readonly : field} tabular`}
          />
        </Field>

        <Field label="VAT treatment" id="fin-vat" className="sm:col-span-2">
          <select id="fin-vat" name="vat_treatment" value={vatTreatment} onChange={(e) => setVatTreatment(e.target.value)} className={field}>
            {Object.entries(VAT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Worked-out tax + net: display only, driven by the VAT treatment. */}
      <Panel title="VAT working" className="mt-5">
        <div className={`grid grid-cols-2 gap-4 ${onConsignment ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <div>
            <p className="label">Total cost £</p>
            <p className={figure}>{gbp(totalCost)}</p>
          </div>
          <div>
            <p className="label">VAT due £</p>
            <p className={figure}>{soldNum > 0 ? gbp(vatDue) : "—"}</p>
            <p className={note}>
              {thirdParty
                ? "No VAT: sold by a third party"
                : vatTreatment === "margin_scheme"
                  ? "1/6 of margin (sale − total cost)"
                  : vatTreatment === "standard"
                    ? "1/6 of sale price"
                    : "No VAT on this treatment"}
            </p>
          </div>
          <div>
            <p className="label">Net of VAT £</p>
            <p className={figure}>{soldNum > 0 ? gbp(netAmount) : "—"}</p>
            {reclaimableImportVat > 0 ? (
              <p className="mt-1 text-[12px] font-medium leading-[1.4] text-body">
                Import VAT of {gbp(reclaimableImportVat)} is reclaimable on this item, noted in the stock book.
              </p>
            ) : null}
          </div>
          {onConsignment ? (
            <div>
              <p className="label">J.v.d.B. share £</p>
              <p className={figure}>{soldNum > 0 ? gbp(jvbSplit?.jvbReceived ?? 0) : "—"}</p>
              <p className={note}>
                {/* Nothing to split until there is a sale £. */}
                {soldNum > 0 ? (
                  <>
                    net profit {gbp(jvbSplit?.jvbNetProfit ?? 0)}
                    {jvbSplit && jvbSplit.jvbBorne > 0 ? ` + ${gbp(jvbSplit.jvbBorne)} costs reimbursed` : ""} ·{" "}
                  </>
                ) : null}
                on consignment
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      <p className="mt-3 max-w-[var(--jvb-measure)] text-[12px] leading-[1.4] text-meta">
        The sale £ is worked out automatically from the spot rate on the sale date (or typed
        in by hand if no rate is available), and kept as recorded until the price, currency or
        date change; the purchase £ is entered by hand. VAT and net update from the VAT
        treatment above and are shown for reference; they aren’t stored.
      </p>
    </div>
  );
}
