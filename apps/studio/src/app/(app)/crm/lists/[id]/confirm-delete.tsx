"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * The list page's Delete button, with the same inline confirm step the lists
 * index already asks for. It renders only buttons and sits inside the page's
 * own <form action={deleteList}>, so the form and what it posts are unchanged;
 * a single click no longer deletes the list.
 */
export function ConfirmDelete({ name }: { name: string }) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-body hover:text-ink-strong"
      >
        Delete list
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-ink-body">
        Delete “{name}”? This can’t be undone.
      </span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-danger px-3 py-1.5 text-[12px] font-semibold text-danger hover:bg-danger-wash disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        autoFocus
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
      >
        Cancel
      </button>
    </div>
  );
}
