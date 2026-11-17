"use client";

import { Button } from "@/components/ui/button";
import { PrintIcon } from "@/components/ui/icons";

/**
 * Opens the browser's print dialog (print, or save as PDF). A plain button
 * with a click handler: the form with action="javascript:window.print()" it
 * replaces never printed, because React 19 blocks javascript: URLs in a
 * form action and the CSP's form-action 'self' refuses them too.
 */
export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="primary" icon={<PrintIcon size={14} />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
