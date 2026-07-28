"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Rotate an image 90° counter-clockwise. Each press rotates and saves; there is
 * no separate confirm, because the operation is cheap and trivially undone by
 * pressing three more times.
 *
 * The rotated derivative keeps its storage path, so a cached copy would be a
 * problem — except the page mints a fresh signed URL on every render, and the
 * token differs each time. `router.refresh()` therefore re-fetches under a new
 * URL and the new orientation shows immediately.
 */
export function RotateImageButton({
  imageId,
  disabled,
}: {
  imageId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/images/${imageId}/rotate`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not rotate");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rotate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void rotate()}
        disabled={busy || disabled}
        title="Rotate 90° anticlockwise"
        aria-label="Rotate 90° anticlockwise"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line-control bg-control text-ink-mid hover:text-ink-strong disabled:opacity-50"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={busy ? "animate-spin" : undefined}
        >
          {/* arrow curving anticlockwise over the top */}
          <path
            d="M4 9a8 8 0 1 1 1.5 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M3.5 4.5V9.5H8.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
      {error ? <span className="ml-1 text-[11px] text-danger">{error}</span> : null}
    </>
  );
}
