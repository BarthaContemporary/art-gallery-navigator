import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the record editor: the title block, the sticky save line with
 * its section rail, then sections of fields on the editor's grid. Without it
 * the record page's skeleton showed here, a different layout from the one
 * that then arrived.
 */
export default function EditRecordLoading() {
  return (
    <div role="status" className="max-w-[var(--jvb-measure-wide)]">
      <span className="sr-only">Loading the editor</span>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span aria-hidden className="jvb-hatch block h-20 w-20" />
          <div>
            <Skeleton width={260} height={22} />
            <Skeleton width={80} height={12} className="mt-2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton width={128} height={28} />
          <Skeleton width={104} height={28} />
          <Skeleton width={112} height={28} />
        </div>
      </div>

      {/* save line + rail */}
      <div className="mb-6 border-b border-rule">
        <div className="flex items-center justify-between py-1">
          <Skeleton width={150} height={12} />
          <Skeleton width={56} height={28} />
        </div>
        <div className="flex gap-4 py-2">
          {[72, 72, 64, 64, 48, 120].map((w, i) => (
            <Skeleton key={i} width={w} height={12} />
          ))}
        </div>
      </div>

      {[6, 4].map((fields, s) => (
        <div key={s} className="section mb-8">
          <Skeleton width={110} height={14} className="mb-4" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: fields }).map((_, i) => (
              <div key={i}>
                <Skeleton width={72} height={10} />
                <Skeleton height={32} className="mt-1.5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
