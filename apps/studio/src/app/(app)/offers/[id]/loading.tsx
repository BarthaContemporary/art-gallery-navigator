import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for one offer: the header, the Details form, the
 * works and the recipients table. The page resolves list sizes, the works
 * and any reply notes before it can draw.
 */
export default function OfferLoading() {
  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Skeleton width={80} height={12} />
          <Skeleton width={280} height={26} className="mt-2" />
          <Skeleton width={190} height={12} className="mt-2" />
        </div>
        <Skeleton width={150} height={32} />
      </div>

      <div className="space-y-6">
        <div className="border-t border-rule-strong pt-3">
          <Skeleton width={60} height={14} />
          <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}>
                <Skeleton width={70} height={10} />
                <Skeleton height={32} className="mt-1.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-rule-strong pt-3">
          <Skeleton width={60} height={14} />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={56} />
            ))}
          </div>
        </div>

        <div className="border-t border-rule-strong pt-3">
          <Skeleton width={90} height={14} />
          <SkeletonTable rows={4} columns={4} label="Loading the offer" className="mt-4" />
        </div>
      </div>
    </div>
  );
}
