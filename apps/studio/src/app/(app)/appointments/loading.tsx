import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * The appointments page's own placeholder (W16), shown while its bookings
 * load: the header, a month grid's frame and the Upcoming table. The month
 * is not known here (it is in the URL the page reads), so the grid carries
 * no dates; once the page renders, the grid streams in behind its own
 * placeholder while the shared calendar answers.
 */
export default function AppointmentsLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading appointments</span>
      <div className="mb-6">
        <Skeleton width={190} height={24} />
        <Skeleton width={150} height={12} className="mt-2.5" />
      </div>
      <div className="space-y-6">
        <div className="border-t border-rule-strong pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton width={130} height={16} />
            <Skeleton width={140} height={28} />
          </div>
          <div className="sm:hidden">
            <Skeleton height={280} />
          </div>
          <div className="hidden border border-rule-strong sm:block">
            <div className="h-[29px] border-b border-rule-strong" />
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }, (_, i) => (
                <div
                  key={i}
                  className={`min-h-[104px] border-rule ${i % 7 !== 0 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-rule-strong pt-3">
          <Skeleton width={90} height={16} className="mb-3" />
          <SkeletonTable rows={5} columns={7} label="Loading upcoming appointments" />
        </div>
      </div>
    </div>
  );
}
