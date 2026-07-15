"use client";

import { useState } from "react";

/** Delete button with an inline confirm step (server action passed in). */
export function DeleteContactButton({ action }: { action: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink-strong"
      >
        Delete contact
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-ink-body">
        Delete this contact permanently? This can’t be undone.
      </span>
      <button
        type="submit"
        className="rounded-lg border border-oranje bg-oranje/10 px-3 py-1.5 text-[12px] font-semibold text-oranje"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
      >
        Cancel
      </button>
    </form>
  );
}
