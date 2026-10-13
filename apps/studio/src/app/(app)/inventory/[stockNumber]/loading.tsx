import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level skeleton for the piece-detail page, which fires a dozen queries
 * and then signs image URLs, so navigation would otherwise block on a blank
 * screen. It mirrors the real layout in the wide measure: the record bar, the
 * square gallery beside the title and the facts on hairlines, then a section.
 * The edit and images pages have their own (edit/loading.tsx,
 * images/loading.tsx).
 */
export default function PieceDetailLoading() {
  return (
    <div role="status" className="max-w-[var(--jvb-measure-wide)]">
      <span className="sr-only">Loading the record</span>

      {/* record bar */}
      <div className="-mt-2 mb-6 flex items-center justify-between gap-4 border-b border-rule py-2.5">
        <Skeleton width={180} height={12} />
        <div className="flex gap-2">
          <Skeleton width={84} height={32} />
          <Skeleton width={104} height={32} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* gallery */}
        <div>
          <span aria-hidden className="jvb-hatch block aspect-square w-full" />
          <div className="mt-2.5 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} aria-hidden className="jvb-hatch block aspect-square w-full max-w-[96px]" />
            ))}
          </div>
        </div>

        {/* identity + facts */}
        <div>
          <div className="flex gap-3">
            <Skeleton width={64} height={20} />
            <Skeleton width={96} height={20} />
          </div>
          <Skeleton width={140} height={12} className="mt-6" />
          <Skeleton width="80%" height={28} className="mt-2" />
          <Skeleton width={160} height={14} className="mt-2" />
          <div className="mt-6 grid grid-cols-2 border-t border-rule-strong">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-b border-rule py-2.5 pr-3">
                <Skeleton width={64} height={10} />
                <Skeleton width="70%" height={14} className="mt-2" />
              </div>
            ))}
          </div>
          <div className="section mt-8 space-y-2">
            <Skeleton width={96} height={14} />
            <Skeleton width="96%" />
            <Skeleton width="100%" />
            <Skeleton width="72%" />
          </div>
        </div>
      </div>
    </div>
  );
}
