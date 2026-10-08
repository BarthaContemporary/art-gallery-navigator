"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

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
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          visible
            ? "rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg"
            : "text-[12px] font-medium text-ink-soft hover:text-ink-strong"
        }
      >
        {visible ? `Put all ${count} on the website` : `Take all ${onCount} off the website`}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-lg border border-line-soft bg-band/40 px-3 py-2">
      <input type="hidden" name="visible" value={visible ? "on" : ""} />
      <span className="text-[12px] text-ink-body">
        {visible
          ? `Switch ${affected} work${affected === 1 ? "" : "s"} to “On website — yes”? The site picks them up within a few minutes; a work without a processed image appears without a picture.`
          : `Take ${affected} work${affected === 1 ? "" : "s"} off the website? They leave the site within a few minutes.`}
      </span>
      <SubmitButton
        variant={visible ? "primary" : "ghost"}
        pendingLabel={visible ? "Publishing…" : "Removing…"}
        className="!px-3 !py-1.5 !text-[12px]"
      >
        {visible ? "Yes, publish" : "Yes, take off"}
      </SubmitButton>
      <button type="button" onClick={() => setConfirming(false)} className="text-[12px] font-medium text-ink-mid hover:text-ink-strong">
        Cancel
      </button>
    </form>
  );
}
