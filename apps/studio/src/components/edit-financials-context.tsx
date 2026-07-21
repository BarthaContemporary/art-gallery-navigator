"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Shared, live state for the pieces of the edit page that influence each other:
 * the Financials panel, the Import (VAT) panel and the Consignment panel. This
 * lets, e.g., toggling "Sale handled by J.v.d.B." in the consignment panel
 * instantly relabel the sold price and zero the VAT in Financials, and lets the
 * import VAT flow into the margin-scheme cost base.
 */
export type EditFinancialsState = {
  soldGbp: number;
  totalCost: number; // cost + restoration + other (excludes import VAT)
  vatTreatment: string;
  saleHandled: "" | "yes" | "no";
  sharePct: string;
  importType: "" | "import_vat_paid" | "import_vat_deferred" | "temporary_import";
  importVatGbp: number;
};

type Ctx = EditFinancialsState & { patch: (p: Partial<EditFinancialsState>) => void };

const FinancialsContext = createContext<Ctx | null>(null);

export function EditFinancialsProvider({
  initial,
  children,
}: {
  initial: EditFinancialsState;
  children: ReactNode;
}) {
  const [state, setState] = useState<EditFinancialsState>(initial);
  const patch = (p: Partial<EditFinancialsState>) => setState((prev) => ({ ...prev, ...p }));
  return <FinancialsContext.Provider value={{ ...state, patch }}>{children}</FinancialsContext.Provider>;
}

/** Returns the shared state, or null when rendered outside the provider. */
export function useEditFinancials(): Ctx | null {
  return useContext(FinancialsContext);
}
