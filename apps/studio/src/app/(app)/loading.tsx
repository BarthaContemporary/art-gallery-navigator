import { Skeleton } from "@/components/ui/skeleton";

// Column widths of the placeholder rows: one wide column, as a name or title.
const COLUMNS = ["12%", "30%", "16%", "12%", "10%"];

/**
 * The fallback for every studio page without a loading.tsx of its own (W16):
 * shown inside the shell the moment a link is followed, so a page waiting on
 * its queries never leaves the previous page standing with no sign of the
 * click. Shaped like the common page (a title, a line, then rows) rather than
 * any one page, so it reads as "loading" wherever it appears.
 *
 * Built from bare Skeleton blocks under one role="status", so a screen
 * reader hears "Loading page" once (the SkeletonText/SkeletonTable
 * composites each announce themselves).
 */
export default function AppLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading page</span>
      <div className="mb-6">
        <Skeleton width={220} height={24} />
        <Skeleton width={140} height={12} className="mt-2.5" />
      </div>
      <div className="max-w-[var(--jvb-measure)] space-y-2">
        <Skeleton width="92%" />
        <Skeleton width="60%" />
      </div>
      <div className="mt-6">
        <div className="flex gap-4 border-b border-rule-strong px-3 py-2.5">
          {COLUMNS.map((w, c) => (
            <Skeleton key={c} height={10} width={w} />
          ))}
        </div>
        {Array.from({ length: 8 }, (_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-rule px-3 py-[var(--jvb-row-py)]">
            {COLUMNS.map((w, c) => (
              <Skeleton key={c} width={w} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
