import type { Metadata } from "next";
import Link from "next/link";
import { PRIVATE_PAGE_REFERRER } from "@/lib/private-paths";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false }, referrer: PRIVATE_PAGE_REFERRER };

/** Where "Confirm subscription" (newsletter/confirm/route.ts) lands. */
export default function ConfirmedPage() {
  return (
    <div className="page py-[var(--section)]">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">You’re subscribed</h1>
          <p className="mt-6 max-w-[var(--measure)] font-serif text-body text-ink-70">
            Thank you — we’ll send you news of exhibitions, fairs and new works. Every email carries an unsubscribe
            link, and you can withdraw consent at any time.
          </p>
          <p className="mt-8">
            <Link href="/" className="link-accent font-sans text-ui">
              Back to the gallery →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
