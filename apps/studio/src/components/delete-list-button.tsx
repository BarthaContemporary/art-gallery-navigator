"use client";

import { useState } from "react";

/** Delete-a-list button with an inline confirm step (server action passed in). */
export function DeleteListButton({
  action,
  id,
  name,
  extra,
}: {
  action: (formData: FormData) => void;
  id: string;
  name: string;
  /** Extra hidden fields the action needs, e.g. which table the row is in. */
  extra?: Record<string, string>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[12px] font-medium text-ink-soft hover:text-ink-strong"
      >
        Delete
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="text-[11.5px] text-ink-body">Delete “{name}”?</span>
      <button
        type="submit"
        className="rounded-md border border-oranje bg-oranje/10 px-2 py-0.5 text-[11.5px] font-semibold text-oranje"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[11.5px] font-medium text-ink-mid hover:text-ink-strong"
      >
        Cancel
      </button>
    </form>
  );
}
