"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

/**
 * Delete with an inline confirm step (server action passed in): "Delete" →
 * "Delete “name”? Yes, delete / Cancel".
 *
 * The first step's look follows spec R4 for destructive actions: on its own
 * (standalone, e.g. a record's "Delete this record" section) it is a danger
 * button; in a table or list row (the default) it is a quiet button in the
 * danger colour, so a column of rows is not a column of red boxes but a
 * delete still never looks like the mildest action in its row. The confirm
 * step is the same everywhere.
 *
 * Focus follows the step: the confirm opens on Cancel (the safe choice, so
 * a second Enter does not delete), and Cancel returns it to Delete.
 */
export function DeleteListButton({
  action,
  id,
  name,
  extra,
  standalone = false,
}: {
  action: (formData: FormData) => void;
  id: string;
  name: string;
  /** Extra hidden fields the action needs, e.g. which table the row is in. */
  extra?: Record<string, string>;
  /**
   * A destructive action standing on its own rather than in a table or list
   * row: the first step is then a danger button.
   */
  standalone?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  /** Set when Cancel closes the confirm, so focus goes back to Delete. */
  const returnFocus = useRef(false);

  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      trigger.current?.focus();
    }
  }, [confirming]);

  if (!confirming) {
    return (
      <Button
        ref={trigger}
        variant={standalone ? "danger" : "quiet"}
        size="sm"
        aria-label={`Delete ${name}`}
        className={standalone ? undefined : "text-danger"}
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
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
      <Button type="submit" variant="danger" size="sm" pendingLabel="Deleting…">
        Yes, delete
      </Button>
      <Button
        ref={cancel}
        variant="quiet"
        size="sm"
        onClick={() => {
          returnFocus.current = true;
          setConfirming(false);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}
