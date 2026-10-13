"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Rotate an image 90° anticlockwise. Each press rotates and saves; there is
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
      {/* The shared icon set has only a clockwise arrow, so the
          anticlockwise one stays drawn here, at the set's stroke weight. */}
      <Button
        size="sm"
        iconOnly
        label="Rotate 90° anticlockwise"
        onClick={() => void rotate()}
        disabled={disabled}
        pending={busy}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          {/* arrow curving anticlockwise over the top */}
          <path
            d="M4 9a8 8 0 1 1 1.5 7"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M3.5 4.5V9.5H8.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </Button>
      {error ? (
        <span role="alert" className="ml-1 text-[12px] text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
