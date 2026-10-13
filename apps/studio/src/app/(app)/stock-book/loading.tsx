import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * The stock book's own placeholder (W16): its header, the period chips and
 * the filter row, then a wide table, so the page does not jump when the book
 * arrives. The views compute VAT for every row, which is the slow part.
 */
export default function StockBookLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton width={150} height={24} />
          <Skeleton width={320} height={12} className="mt-2.5" />
        </div>
        <div className="flex gap-2">
          <Skeleton width={96} height={32} />
          <Skeleton width={104} height={32} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[88, 32, 32, 32, 32, 48, 72].map((w, i) => (
            <Skeleton key={i} width={w} height={28} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {[160, 160, 160].map((w, i) => (
            <Skeleton key={i} width={w} height={32} />
          ))}
          <Skeleton width={64} height={32} />
        </div>
        <Skeleton width={140} height={28} />
      </div>
      <SkeletonTable rows={12} columns={9} label="Loading the stock book" className="mt-5" />
    </div>
  );
}
