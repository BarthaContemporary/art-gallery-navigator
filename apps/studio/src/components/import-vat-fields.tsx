"use client";

import { useEffect, useRef, useState } from "react";
import { parseAmount } from "@/lib/amount";
import { AmountInput } from "@/components/amount-input";
import { useEditFinancials } from "@/components/edit-financials-context";
import { useSaveReporter } from "@/components/ui/save-status";
import { Field } from "@/components/ui/field";
import { useFlushForDone, useStateAutosave } from "@/components/editor-save";

const TYPES: [string, string][] = [
  ["", "—"],
  ["import_vat_paid", "Import VAT paid"],
  ["import_vat_deferred", "Import VAT deferred"],
  ["temporary_import", "Temporary import"],
];

/**
 * Import type + import VAT for the piece, inside the Import shipment panel.
 * Autosaves to piece_financials and feeds the shared financials state (so the
 * VAT / net / margin figures update live) and the stock book. Its save state
 * goes to the editor's one status line, and Done saves it before leaving.
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

  const ctx = useEditFinancials();
  const first = useRef(true);

  useEffect(() => {
    ctx?.patch({
      importType: (importType as "" | "import_vat_paid" | "import_vat_deferred" | "temporary_import") || "",
      importVatGbp: parseAmount(importVat) ?? 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importType, importVat]);

  // The request for what the fields show now; the autosave calls it through
  // a ref, so a retry sends the latest values.
  const send = (): Promise<boolean> => {
    const body = new FormData();
    body.set("import_type", importType);
    body.set("import_vat_gbp", importType === "import_vat_paid" ? importVat : "");
    return fetch(`/api/inventory/${encodeURIComponent(stockNumber)}/import-vat`, {
      method: "PATCH",
      body,
    }).then(
      (res) => res.ok,
      () => false,
    );
  };
  const { status, save, schedule, flush } = useStateAutosave(send);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [importType, importVat, schedule]);

  // Into the editor's one status line, and Done's list of parts to save.
  const report = useSaveReporter("import-vat");
  useEffect(() => {
    report({ state: status, what: "the import VAT", onRetry: status === "error" ? () => void save() : undefined });
  }, [report, status, save]);
  useFlushForDone("import-vat", flush);

  return (
    <div className="mt-4 border-t border-rule pt-3">
      <p className="label">Import VAT (stock book)</p>
      <div className="mt-2 flex flex-col gap-3">
        <Field label="Type of import" id="import-vat-type">
          <select id="import-vat-type" value={importType} onChange={(e) => setImportType(e.target.value)} className="field">
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {importType === "import_vat_paid" ? (
          <Field
            label="Import VAT paid £"
            id="import-vat-paid"
            hint="Margin scheme: added to costs. Standard or zero-rated: reclaimable, noted in the stock book."
          >
            <AmountInput
              id="import-vat-paid"
              value={importVat}
              onChange={(e) => setImportVat(e.target.value)}
              aria-describedby="import-vat-paid-hint"
              className="field tabular"
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}
