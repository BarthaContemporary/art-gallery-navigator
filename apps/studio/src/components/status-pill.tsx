const LABELS: Record<string, string> = {
  in_stock: "Available",
  reserved: "Reserved",
  consigned_in: "Consigned in",
  consigned_out: "Consigned out",
  sold: "Sold",
  gifted: "Gifted",
  returned: "Returned",
  written_off: "Written off",
};

// Semantic dot colour per status — greyscale for settled/terminal states,
// muted colour only where it signals something actionable.
const DOT: Record<string, string> = {
  in_stock: "var(--jvb-status-green)",
  reserved: "var(--jvb-warn)",
  consigned_in: "var(--jvb-info)",
  consigned_out: "var(--jvb-info)",
  sold: "var(--jvb-ink-muted)",
  gifted: "var(--jvb-ink-muted)",
  returned: "var(--jvb-warn)",
  written_off: "var(--jvb-danger)",
};

/**
 * `pill` — the focal, bordered status chip for the piece-detail header.
 * `inline` — a compact dot + label for dense table rows, without pill chrome.
 */
export function StatusPill({
  status,
  variant = "pill",
}: {
  status: string;
  variant?: "pill" | "inline";
}) {
  const label = LABELS[status] ?? status;
  const dot = DOT[status] ?? "var(--jvb-ink-muted)";

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-body">
        <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: dot }} />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-pill px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--jvb-ink-label)]">
      <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: dot }} />
      {label}
    </span>
  );
}
