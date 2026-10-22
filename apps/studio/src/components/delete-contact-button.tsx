"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Delete button with an inline confirm step (server action passed in). */
export function DeleteContactButton({ action }: { action: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete contact
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <span className="text-[12.5px] text-body">Delete this contact permanently? This can’t be undone.</span>
      <Button type="submit" variant="danger" size="sm" pendingLabel="Deleting…">
        Yes, delete
      </Button>
      <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
