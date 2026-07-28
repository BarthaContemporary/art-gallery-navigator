/*
 * The label is repeated here rather than imported from lib/piece-store so that
 * client components (the inventory table, the edit header) don't pull the
 * store's query helpers into the browser bundle for the sake of one string.
 */
type Ledger = "jvb" | "external";
const NOT_JVB = "Not JvdB";

/**
 * Marks a work as belonging to the non-JvdB register.
 *
 * Deliberately silent for JvdB stock: that is the overwhelming majority and the
 * default reading, so badging it would be noise on every row. The badge only
 * appears where the answer is the surprising one.
 */
export function RegisterBadge({
  ledger,
  size = "sm",
}: {
  ledger: Ledger | null | undefined;
  size?: "sm" | "xs";
}) {
  if (ledger !== "external") return null;
  return (
    <span
      title="Held and handled like stock, but not JvdB property. Never enters the stock book."
      className={`inline-flex shrink-0 items-center rounded-full border border-line bg-pill font-semibold uppercase tracking-[0.05em] text-ink-soft ${
        size === "xs" ? "px-1.5 py-0 text-[9.5px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {NOT_JVB}
    </span>
  );
}
