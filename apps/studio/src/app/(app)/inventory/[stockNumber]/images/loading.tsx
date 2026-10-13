import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for image management: the page header, the upload panel and the
 * grid of square tiles, so moving between works with ← / → shows the layout
 * at once while the next work's images are signed.
 */
export default function ManageImagesLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading the images</span>

      <div className="mb-6">
        <Skeleton width={100} height={12} />
        <Skeleton width={120} height={22} className="mt-2" />
        <Skeleton width={260} height={12} className="mt-2" />
      </div>

      <div className="panel">
        <Skeleton width={40} height={10} />
        <Skeleton width={220} height={32} className="mt-1.5" />
        <Skeleton height={72} className="mt-3" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-rule p-2.5">
            <span aria-hidden className="jvb-hatch block aspect-square w-full" />
            <Skeleton width={56} height={10} className="mt-3" />
            <Skeleton height={28} className="mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
