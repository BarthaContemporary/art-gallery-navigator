import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for one contact. The page reads the contact, its
 * purchases, consignments and legal holds before it can draw; this keeps the
 * header, the save line and the Details fields in place meanwhile.
 */
export default function ContactLoading() {
  return (
    <div role="status" className="max-w-[var(--jvb-measure-wide)]">
      <span className="sr-only">Loading the contact</span>
      <div className="mb-6">
        <Skeleton width={100} height={12} />
        <Skeleton width={240} height={26} className="mt-2" />
        <Skeleton width={200} height={12} className="mt-2" />
        <div className="mt-4 flex gap-1.5">
          <Skeleton width={130} height={20} />
          <Skeleton width={150} height={20} />
        </div>
      </div>
      <Skeleton width={150} height={12} />
      <div className="mt-6 border-t border-rule-strong pt-3">
        <Skeleton width={70} height={14} />
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <Skeleton width={i % 2 ? 64 : 84} height={10} />
              <Skeleton height={32} className="mt-1.5" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 border-t border-rule-strong pt-3">
        <Skeleton width={60} height={14} />
        <Skeleton width="70%" className="mt-4" />
        <Skeleton width="55%" className="mt-2" />
      </div>
    </div>
  );
}
