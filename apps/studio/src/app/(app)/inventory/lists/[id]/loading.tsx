import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for one inventory list. The page resolves the members,
 * their change log and thumbnails before it can draw, which on a long list is
 * long enough to notice; this keeps its shape (header, the Website and Output
 * groups, the works table) in place meanwhile.
 */
export default function InventoryListLoading() {
  return (
    <div className="max-w-[960px]">
      <div className="mb-6">
        <Skeleton width={120} height={12} />
        <Skeleton width={260} height={26} className="mt-2" />
        <Skeleton width={180} height={12} className="mt-2" />
      </div>

      <div className="grid gap-x-8 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {[0, 1].map((g) => (
          <div key={g} className="border-t border-rule-strong pt-2">
            <Skeleton width={64} height={10} />
            <div className="mt-2 flex gap-2">
              <Skeleton width={140} height={28} />
              <Skeleton width={120} height={28} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-rule-strong pt-3">
        <Skeleton width={150} height={14} />
        <SkeletonTable rows={10} columns={5} label="Loading the list" className="mt-4" />
      </div>
    </div>
  );
}
