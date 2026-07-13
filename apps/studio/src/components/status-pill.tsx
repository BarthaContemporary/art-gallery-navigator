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

export function StatusPill({ status }: { status: string }) {
  const available = status === "in_stock";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-pill px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--jvb-ink-label)]">
      {available ? (
        <span
          aria-hidden
          className="inline-block h-[6px] w-[6px] rounded-full bg-status-green"
        />
      ) : null}
      {LABELS[status] ?? status}
    </span>
  );
}
