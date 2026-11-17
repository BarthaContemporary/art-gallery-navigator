"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * A list page's Delete button (the CRM list and the inventory list), with an
 * inline confirm step. It renders only buttons and sits inside the page's
 * own <form action={deleteList}>, so the form and what it posts are
 * unchanged; a single click no longer deletes the list.
 */
export function ConfirmDelete({ name, note }: { name: string; note?: string }) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete list
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] leading-[1.45] text-body">
        Delete “{name}”? This can’t be undone.{note ? ` ${note}` : ""}
      </span>
      <Button type="submit" variant="danger" size="sm" pendingLabel="Deleting…">
        Yes, delete
      </Button>
      <Button variant="quiet" size="sm" autoFocus disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
