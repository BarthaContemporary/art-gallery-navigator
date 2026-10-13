"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cleanNumberPaste } from "@/lib/amount";
import { useEditFinancials } from "@/components/edit-financials-context";
import { consignmentSplit } from "@/lib/consignment";
import { useSaveReporter } from "@/components/ui/save-status";
import { Field } from "@/components/ui/field";
import { Panel, Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { CloseIcon } from "@/components/ui/icons";
import { useFlushForDone, useStateAutosave } from "@/components/editor-save";

const figure = "tabular mt-1 text-[14.5px] leading-[1.45] text-ink";
const note = "mt-0.5 text-[12px] leading-[1.4] text-meta";
const round2 = (n: number) => Math.round(n * 100) / 100;
const gbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Settlement = {
  soldGbp: number | null;
  totalCostGbp: number | null;
  vatTreatment: string;
} | null;

/**
 * Consignment panel: lives below Temporary exports. Autosaves on its own
 * endpoint (partial update) so it doesn't disturb the main record form, and
 * shows a live settlement split for admin/accountant. Its save state goes to
 * the editor's one status line (W14), and Done saves it before leaving.
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

  const first = useRef(true);

  const pctNum = sharePct.trim() === "" ? null : Number(sharePct);
  const pctInvalid = pctNum !== null && (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum >= 100);

  // The request for what the panel shows now; the autosave calls it through a
  // ref, so a retry sends the latest values. Nothing is sent until the share
  // is fixed (null); the field says why.
  const send = (): Promise<boolean> | null => {
    if (pctInvalid) return null;
    const body = new FormData();
    body.set("co_owner_consignee", coOwner);
    body.set("consignee_contact_id", coOwnerContactId);
    body.set("consignment_details", notes);
    body.set("consignment_share_pct", sharePct);
    body.set("sale_handled_by_jvb", saleHandled);
    return fetch(`/api/inventory/${encodeURIComponent(stockNumber)}/consignment`, {
      method: "PATCH",
      body,
    }).then(
      (res) => res.ok,
      () => false,
    );
  };
  const { status, save, schedule, flush } = useStateAutosave(send);

  // Debounced autosave on any change (skip the initial mount).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [coOwner, coOwnerContactId, notes, sharePct, saleHandled, schedule]);

  // Into the editor's one status line, and Done's list of parts to save.
  const report = useSaveReporter("consignment");
  useEffect(() => {
    report({
      state: status,
      what: pctInvalid ? "the consignment: the share must be more than 0 and less than 100" : "the consignment",
      onRetry: status === "error" && !pctInvalid ? () => void save() : undefined,
    });
  }, [report, status, pctInvalid, save]);
  useFlushForDone("consignment", flush);

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

  return (
    <Section title="Consignment">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <Field label="Co-owner / consignee" id="consign-co-owner">
            <input
              id="consign-co-owner"
              value={coOwner}
              onChange={(e) => setCoOwner(e.target.value)}
              placeholder="Name, or link a CRM contact below"
              className="field"
            />
          </Field>
          {coOwnerContactId ? (
            <span className="inline-flex min-h-[var(--jvb-control-h-sm)] w-fit items-center gap-1 border border-rule-strong pl-2.5 text-[13px] text-ink">
              Linked contact
              <Button variant="quiet" size="sm" iconOnly label="Unlink contact" onClick={unlinkContact}>
                <CloseIcon size={14} />
              </Button>
            </span>
          ) : (
            <Field label="Link a CRM contact (optional)" id="consign-contact-search">
              <input
                id="consign-contact-search"
                type="search"
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search CRM contacts…"
                className="field"
              />
              {contactSearching ? (
                <p className="mt-1 text-[12px] text-meta">Searching…</p>
              ) : contactHits.length > 0 ? (
                <ul data-inset-focus className="mt-1 divide-y divide-rule overflow-hidden border border-rule-strong">
                  {contactHits.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickContact(c)}
                        className="flex w-full flex-col items-start px-3 py-1.5 text-left text-[13px] text-ink hover:bg-band"
                      >
                        <span>{c.name}</span>
                        {c.email ? <span className="text-[12px] text-body">{c.email}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : contactQuery.trim().length >= 2 ? (
                <p className="mt-1 text-[12px] text-meta">No matches.</p>
              ) : null}
            </Field>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Field
            label="Share / commission (%)"
            id="consign-share"
            hint="If consigned out, add the percentage received by J.v.d.B."
            error={pctInvalid ? "Must be more than 0 and less than 100." : undefined}
          >
            <input
              id="consign-share"
              type="number" onPaste={cleanNumberPaste}
              step="0.01"
              min="0.01"
              max="99.99"
              value={sharePct}
              onChange={(e) => setSharePct(e.target.value)}
              aria-invalid={pctInvalid || undefined}
              aria-describedby={pctInvalid ? "consign-share-hint consign-share-error" : "consign-share-hint"}
              className="field tabular"
            />
          </Field>

          <Field label="Sale handled by J.v.d.B." id="consign-sale-handled">
            <select
              id="consign-sale-handled"
              value={saleHandled}
              onChange={(e) => setSaleHandled(e.target.value as "" | "yes" | "no")}
              className="field"
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>

        <Field label="Consignment notes" id="consign-notes" className="sm:col-span-2">
          <textarea
            id="consign-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="field"
          />
        </Field>
      </div>

      {split ? (
        <Panel title="Settlement" className="mt-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="label">VAT due £</p>
              <p className={figure}>{split.thirdParty ? "—" : gbp(split.vat)}</p>
              <p className={note}>{split.thirdParty ? "No VAT (third-party sale)" : "Regular VAT rules"}</p>
            </div>
            <div>
              <p className="label">{split.thirdParty ? "Net sold price £" : "Net after VAT £"}</p>
              <p className={figure}>{gbp(split.netAfterVat)}</p>
              <p className={note}>
                profit pool {gbp(split.profitPool)}
                {split.jvbBorne > 0 ? ` (after ${gbp(split.jvbBorne)} costs)` : ""}
              </p>
            </div>
            <div>
              <p className="label">J.v.d.B. receives £</p>
              <p className={figure}>{gbp(split.jvbReceived)}</p>
              <p className={note}>
                net profit {gbp(split.jvbNetProfit)}
                {split.jvbBorne > 0 ? ` + ${gbp(split.jvbBorne)} costs` : ""}
              </p>
            </div>
            <div>
              <p className="label">Co-owner / consignee receives £</p>
              <p className={figure}>{gbp(split.coOwnerShare)}</p>
              <p className={note}>
                net profit {gbp(split.coOwnerShare)} · {round2(100 - (pctNum ?? 0))}%
              </p>
            </div>
          </div>
        </Panel>
      ) : settlement && pctNum !== null && !pctInvalid && saleHandled === "" ? (
        <p className="mt-3 text-[12px] leading-[1.4] text-meta">
          Set “Sale handled by J.v.d.B.” to work out VAT and the J.v.d.B. share.
        </p>
      ) : null}
    </Section>
  );
}
