/**
 * Route-level skeleton for the piece-detail page, which fires ~13 queries and
 * then signs image URLs — so navigation used to block on a blank screen. This
 * mirrors the real layout: sticky header strip, gallery + title, spec grid.
 */
export default function PieceDetailLoading() {
  return (
    <div className="animate-pulse">
      {/* breadcrumb / header strip */}
      <div className="flex items-center justify-between px-5 py-3 md:px-8">
        <div className="h-3 w-48 rounded bg-placeholder" />
        <div className="h-7 w-24 rounded-lg bg-placeholder" />
      </div>

      <div className="grid grid-cols-1 gap-8 px-5 py-4 md:px-8 lg:grid-cols-[minmax(0,640px)_1fr]">
        {/* gallery */}
        <div>
          <div className="jvb-hatch aspect-[4/5] w-full rounded-[12px]" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="jvb-hatch h-16 w-16 rounded-[9px]" />
            ))}
          </div>
        </div>

        {/* title + spec */}
        <div>
          <div className="h-3 w-32 rounded bg-placeholder" />
          <div className="mt-3 h-8 w-3/4 rounded bg-placeholder" />
          <div className="mt-2 h-4 w-40 rounded bg-placeholder" />

          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[11px] border border-line bg-line">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-cell px-3 py-3">
                <div className="h-2.5 w-12 rounded bg-placeholder" />
                <div className="mt-2 h-3.5 w-16 rounded bg-placeholder" />
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2">
            <div className="h-3 w-full rounded bg-placeholder" />
            <div className="h-3 w-11/12 rounded bg-placeholder" />
            <div className="h-3 w-4/5 rounded bg-placeholder" />
          </div>
        </div>
      </div>
    </div>
  );
}
