"use client";

import { useState } from "react";
import { buttonClass } from "./ui/button-class";

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
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass({ variant: "quiet", size: "sm" })}>
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
      <span className="text-[12px] leading-[1.4] text-body">Delete “{name}”?</span>
      {/* Destructive, so danger rather than the accent (spec R1, R4). */}
      <button type="submit" className={buttonClass({ variant: "danger", size: "sm" })}>
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonClass({ variant: "quiet", size: "sm" })}
      >
        Cancel
      </button>
    </form>
  );
}
