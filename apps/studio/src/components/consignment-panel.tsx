"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditFinancials } from "@/components/edit-financials-context";
import { consignmentSplit } from "@/lib/consignment";

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
type ContactHit = { id: string; name: string; email: string | null };

export function ConsignmentPanel({
  stockNumber,
  initial,
  settlement,
}: {
  stockNumber: string;
  initial: {
    coOwner: string;
    coOwnerContactId: string;
    notes: string;
    sharePct: string;
    saleHandled: "" | "yes" | "no";
  };
  settlement: Settlement;
}) {
  const [coOwner, setCoOwner] = useState(initial.coOwner);
  const [coOwnerContactId, setCoOwnerContactId] = useState(initial.coOwnerContactId);
  const [notes, setNotes] = useState(initial.notes);
  const [sharePct, setSharePct] = useState(initial.sharePct);
  const [saleHandled, setSaleHandled] = useState<"" | "yes" | "no">(initial.saleHandled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // CRM contact search for the co-owner / consignee (optional — a free-text
  // name still works for consignees not in the CRM).
  const [contactQuery, setContactQuery] = useState("");
  const [contactHits, setContactHits] = useState<ContactHit[]>([]);
  const [contactSearching, setContactSearching] = useState(false);
  useEffect(() => {
    const query = contactQuery.trim();
    if (query.length < 2) {
      setContactHits([]);
      setContactSearching(false);
      return;
    }
    setContactSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`/api/crm/contacts/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((json: { results?: ContactHit[] }) => {
          if (!cancelled) setContactHits(json.results ?? []);
        })
        .catch(() => {
          if (!cancelled) setContactHits([]);
        })
        .finally(() => {
          if (!cancelled) setContactSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [contactQuery]);

  const pickContact = (c: ContactHit) => {
    setCoOwnerContactId(c.id);
    setCoOwner(c.name);
    setContactQuery("");
    setContactHits([]);
  };
  const unlinkContact = () => setCoOwnerContactId("");

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
    body.set("consignee_contact_id", coOwnerContactId);
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
  }, [coOwner, coOwnerContactId, notes, sharePct, saleHandled, pctInvalid, stockNumber]);

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
  }, [coOwner, coOwnerContactId, notes, sharePct, saleHandled, save]);

  // Live settlement (admin/accountant only — settlement is null otherwise).
  // Sold price / costs / treatment come live from the Financials + Import
  // panels via shared state, falling back to the values passed at load.
  const liveSold = ctx?.soldGbp ?? settlement?.soldGbp ?? 0;
  const livePurchase = ctx?.purchaseCost ?? 0;
  const liveCosts = ctx?.totalCost ?? settlement?.totalCostGbp ?? 0;
  const liveTreatment = ctx?.vatTreatment ?? settlement?.vatTreatment ?? "margin_scheme";
  const liveImportVatPaid = ctx?.importType === "import_vat_paid" ? ctx?.importVatGbp ?? 0 : 0;

  const split = useMemo(() => {
    if (!settlement || pctNum === null || pctInvalid || saleHandled === "") return null;
    if (liveSold <= 0) return null;
    // Purchase cost drives the margin-scheme VAT but is ignored in the shared
    // pool; restoration / other (liveCosts − purchase) + import VAT are carried
    // by J.v.d.B. out of its own share.
    return consignmentSplit({
      amount: liveSold,
      vatTreatment: liveTreatment,
      saleHandledByJvb: saleHandled === "no" ? false : true,
      purchaseCostGbp: livePurchase,
      extraCostsGbp: Math.max(0, liveCosts - livePurchase),
      importVatPaidGbp: liveImportVatPaid,
      sharePct: pctNum,
    });
  }, [settlement, pctNum, pctInvalid, saleHandled, liveSold, livePurchase, liveCosts, liveTreatment, liveImportVatPaid]);

  const statusText =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? (pctInvalid ? "Share must be 1–99" : "Couldn’t save") : "";

  return (
    <section className="mt-4 rounded-[11px] border border-line bg-cell p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-ink-strong">Consignment</h2>
        <span className={`text-[11px] ${status === "error" ? "text-oranje" : "text-ink-soft"}`}>{statusText}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={label}>
          Co-owner / consignee
          <input
            value={coOwner}
            onChange={(e) => setCoOwner(e.target.value)}
            placeholder="Name, or link a CRM contact below"
            className={field}
          />
          {coOwnerContactId ? (
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-line-control px-2.5 py-0.5 text-[11.5px] text-ink-body">
              Linked contact
              <button
                type="button"
                onClick={unlinkContact}
                aria-label="Unlink contact"
                className="text-ink-muted hover:text-oranje"
              >
                ×
              </button>
            </span>
          ) : (
            <>
              <input
                type="search"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search CRM contacts to assign…"
                className={`${field} mt-1.5`}
              />
              {contactSearching ? (
                <p className="mt-1 text-[11.5px] text-ink-muted">Searching…</p>
              ) : contactHits.length > 0 ? (
                <ul className="mt-1 divide-y divide-line-control overflow-hidden rounded-lg border border-line-control">
                  {contactHits.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickContact(c)}
                        className="flex w-full flex-col items-start px-3 py-1.5 text-left text-[13px] text-ink-body hover:bg-control"
                      >
                        <span>{c.name}</span>
                        {c.email ? <span className="text-[11.5px] text-ink-muted">{c.email}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : contactQuery.trim().length >= 2 ? (
                <p className="mt-1 text-[11.5px] text-ink-muted">No matches.</p>
              ) : null}
            </>
          )}
        </div>

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
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-line-soft bg-band/50 p-4 sm:grid-cols-4">
          <div>
            <p className={label}>VAT due £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{split.thirdParty ? "—" : gbp(split.vat)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">{split.thirdParty ? "no VAT (third-party sale)" : "regular VAT rules"}</p>
          </div>
          <div>
            <p className={label}>{split.thirdParty ? "Net sold price £" : "Net after VAT £"}</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(split.sharedNet)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">purchase cost excluded from split</p>
          </div>
          <div>
            <p className={label}>J.v.d.B. share £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(split.jvbShare)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">
              {sharePct}% of net{split.jvbBorne > 0 ? `, less ${gbp(split.jvbBorne)} costs` : ""}
            </p>
          </div>
          <div>
            <p className={label}>Co-owner / consignee share £</p>
            <p className="mt-1 font-mono text-[15px] text-ink-strong">{gbp(split.coOwnerShare)}</p>
            <p className="mt-0.5 text-[10.5px] text-ink-soft">
              {round2(100 - (pctNum ?? 0))}% of net
            </p>
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
