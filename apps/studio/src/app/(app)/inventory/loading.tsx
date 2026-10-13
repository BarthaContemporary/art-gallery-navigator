import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for the inventory list, shown while the server page's
 * queries resolve instead of a blank screen. Mirrors the page's rhythm (title
 * and actions, the labelled filter bar, the table) so nothing jumps on load.
 */
export default function InventoryLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton width={140} height={26} />
          <Skeleton width={90} height={12} className="mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton width={110} height={32} />
          <Skeleton width={110} height={32} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:flex-wrap">
        {[256, 144, 192, 208, 208, 176, 144].map((w, i) => (
          <div
            key={i}
            className={i === 0 ? "col-span-2 sm:w-[var(--w)]" : "sm:w-[var(--w)]"}
            style={{ ["--w" as string]: `${w}px` }}
          >
            <Skeleton width={56} height={10} />
            <Skeleton height={28} className="mt-1.5" />
          </div>
        ))}
      </div>

      <SkeletonTable rows={12} columns={6} label="Loading the inventory" className="mt-8" />
    </div>
  );
}
