"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Put every work in a list on the website (or take them all off), with an
 * inline confirm: publishing is outward-facing, and the sync pushes within a
 * minute of the click.
 */
export function PublishListButton({
  action,
  count,
  onCount,
  visible,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Works in the list. */
  count: number;
  /** Of those, how many are on the website already. */
  onCount: number;
  /** Which way this button goes. */
  visible: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const affected = visible ? count - onCount : onCount;
  if (count === 0 || affected === 0) return null;

  if (!confirming) {
    return (
      <Button size="sm" variant={visible ? "secondary" : "quiet"} onClick={() => setConfirming(true)}>
        {visible ? `Put all ${count} on the website` : `Take all ${onCount} off the website`}
      </Button>
    );
  }

  return (
    <form action={action} className="flex basis-full flex-wrap items-center gap-2 border-l-[3px] border-rule-strong bg-band px-3 py-2">
      <input type="hidden" name="visible" value={visible ? "on" : ""} />
      <span className="text-[13px] leading-[1.45] text-body">
        {visible
          ? `Put ${affected} work${affected === 1 ? "" : "s"} on the website? The site picks them up within a few minutes; a work without a processed image appears without a picture.`
          : `Take ${affected} work${affected === 1 ? "" : "s"} off the website? They leave the site within a few minutes.`}
      </span>
      <Button
        type="submit"
        size="sm"
        variant={visible ? "primary" : "secondary"}
        pendingLabel={visible ? "Publishing…" : "Removing…"}
      >
        {visible ? "Yes, publish" : "Yes, take off"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
