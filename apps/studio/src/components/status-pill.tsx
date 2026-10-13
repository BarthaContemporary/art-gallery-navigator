import { STATUS_LABELS } from "@/lib/labels";
import { StatusBadge } from "@/components/ui/badge";

// The status words live in lib/labels.ts with the studio's other enum labels.
// Re-exported here so the existing `from "@/components/status-pill"` imports
// (filters, table, palette, buyer select) keep working.
export { STATUS_LABELS };

/**
 * A work's status, now drawn by the shared Badge (components/ui/badge) with
 * the tone from lib/labels (STATUS_TONES): colour only where the state asks
 * for something, neutral for settled states. Props unchanged.
 *
 * `pill` — the square tag for the piece-detail header.
 * `inline` — a dot + word for dense table rows, without tag chrome.
 */
export function StatusPill({
  status,
  variant = "pill",
}: {
  status: string;
  variant?: "pill" | "inline";
}) {
  return <StatusBadge status={status} variant={variant === "inline" ? "dot" : "tag"} />;
}
