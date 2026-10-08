import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A page that exists but is not ready. The real content renders underneath,
 * dimmed, clipped to one screen and inert (no focus, no clicks, hidden from
 * assistive tech), so the layout is still visible and the switch back is
 * instant. The card carries the page's only heading.
 */
export function UnderConstruction({
  children,
  title = "Under construction",
  message = "The artists pages are being rebuilt and will be back shortly.",
}: {
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  return (
    <div className="relative max-h-[70vh] min-h-[60vh] overflow-hidden">
      <div aria-hidden inert className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center px-4 pt-[16vh]">
        <div className="max-w-[420px] border border-hairline bg-page px-8 py-7 text-center">
          <h1 className="label text-accent">{title}</h1>
          <p className="mt-3 font-sans text-body text-ink">{message}</p>
          <p className="mt-5">
            <Link href="/" className="link-accent font-sans text-ui">
              See current events →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
