import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for the contacts list: the header with its actions,
 * the search box, the pager line and a page of rows, so the table does not
 * jump into place when the count and the first hundred contacts arrive.
 */
export default function ContactsLoading() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <Skeleton width={140} height={26} />
          <Skeleton width={90} height={12} className="mt-2" />
        </div>
        <div className="flex gap-2">
          <Skeleton width={96} height={32} />
          <Skeleton width={96} height={32} />
          <Skeleton width={110} height={32} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-80">
          <Skeleton width={56} height={10} />
          <Skeleton height={32} className="mt-1.5" />
        </div>
        <Skeleton width={84} height={32} />
      </div>
      <Skeleton width={120} height={12} className="mt-5" />
      <SkeletonTable rows={12} columns={6} label="Loading contacts" className="mt-4" />
    </div>
  );
}
