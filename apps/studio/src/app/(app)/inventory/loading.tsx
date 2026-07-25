/**
 * Route-level skeleton for the inventory list — shown while the server page's
 * queries resolve, instead of a blank screen. Mirrors the real table's rhythm
 * (thumbnail + a few text columns) so the layout doesn't jump on load.
 */
export default function InventoryLoading() {
  return (
    <div className="animate-pulse">
      {/* toolbar row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-9 w-full max-w-md rounded-lg bg-placeholder sm:w-96" />
        <div className="h-9 w-24 rounded-lg bg-placeholder" />
        <div className="ml-auto h-9 w-28 rounded-lg bg-placeholder" />
      </div>

      {/* table */}
      <div className="mt-4 overflow-hidden rounded-[11px] border border-line">
        <div className="border-b border-line bg-cell px-4 py-2.5">
          <div className="h-3 w-40 rounded bg-placeholder" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-2.5 last:border-0">
            <div className="jvb-hatch h-9 w-9 shrink-0 rounded-md" />
            <div className="h-3 w-24 rounded bg-placeholder" />
            <div className="h-3 flex-1 rounded bg-placeholder" />
            <div className="hidden h-3 w-20 rounded bg-placeholder sm:block" />
            <div className="hidden h-3 w-16 rounded bg-placeholder md:block" />
            <div className="h-3 w-14 rounded bg-placeholder" />
          </div>
        ))}
      </div>
    </div>
  );
}
