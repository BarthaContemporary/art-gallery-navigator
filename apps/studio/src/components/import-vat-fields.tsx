"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditFinancials } from "@/components/edit-financials-context";

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const field = "mt-1.5 w-full rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink";

const TYPES: [string, string][] = [
  ["", "—"],
  ["import_vat_paid", "Import VAT paid"],
  ["import_vat_deferred", "Import VAT deferred"],
  ["temporary_import", "Temporary import"],
];

/**
 * Import type + import VAT for the piece, inside the Import shipment panel.
 * Autosaves to piece_financials and feeds the shared financials state (so the
 * VAT / net / margin figures update live) and the stock book.
 */
export function ImportVatFields({
  stockNumber,
  initial,
}: {
  stockNumber: string;
  initial: { importType: string; importVatGbp: string };
}) {
  const [importType, setImportType] = useState(initial.importType);
  const [importVat, setImportVat] = useState(initial.importVatGbp);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const ctx = useEditFinancials();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    ctx?.patch({
      importType: (importType as "" | "import_vat_paid" | "import_vat_deferred" | "temporary_import") || "",
      importVatGbp: Number(importVat) || 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importType, importVat]);

  const save = useCallback(async () => {
    setStatus("saving");
    const body = new FormData();
    body.set("import_type", importType);
    body.set("import_vat_gbp", importType === "import_vat_paid" ? importVat : "");
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(stockNumber)}/import-vat`, {
        method: "PATCH",
        body,
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }, [importType, importVat, stockNumber]);

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
  }, [importType, importVat, save]);

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">Import VAT (stock book)</span>
        <span className={`text-[10.5px] ${status === "error" ? "text-oranje" : "text-ink-soft"}`}>
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : status === "error" ? "Couldn’t save" : ""}
        </span>
      </div>
      <label className={`${label} mt-2`}>
        Type of import
        <select value={importType} onChange={(e) => setImportType(e.target.value)} className={field}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {importType === "import_vat_paid" ? (
        <label className={`${label} mt-2`}>
          Import VAT paid £
          <input type="number" step="0.01" min="0" value={importVat} onChange={(e) => setImportVat(e.target.value)} className={field} />
          <span className="mt-1 block text-[10px] text-ink-soft">
            Margin scheme: added to costs. Standard / zero-rated: reclaimable — noted in the stock book.
          </span>
        </label>
      ) : null}
    </div>
  );
}
