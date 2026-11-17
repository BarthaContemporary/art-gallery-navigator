"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition } from "react";

/**
 * A page that could not be rendered, most often because Sanity did not
 * answer (lib/sanity sanityFetch `required`). Shown only when no earlier
 * copy of the page is cached; a page already cached keeps being served
 * while its regeneration fails. Says "try again", never "not found".
 */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // The failure was on the server: fetch the page again, then re-render it.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="page flex flex-col items-start py-[var(--section)]">
      <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
        This page could not be loaded just now
      </h1>
      <p className="mt-4 max-w-[var(--measure)] font-serif text-body text-ink-70">
        Something went wrong on our side. Please try again in a moment.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <button type="button" onClick={retry} className="btn">
          Try again
        </button>
        <Link href="/" className="btn">
          Back to the gallery
        </Link>
      </div>
    </div>
  );
}
