"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Move a record between the JvdB register and the non-JvdB one.
 *
 * This is the one action in the app that retires a stock number, so it does not
 * sit in the autosaving edit form where a mis-click would fire it silently. It
 * asks first, and the question names the exact consequence (which number is
 * retired and roughly what replaces it) rather than a generic "are you sure".
 */
export function RegisterMove({
  action,
  ledger,
  stockNumber,
}: {
  action: (formData: FormData) => void;
  ledger: "jvb" | "external";
  stockNumber: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const noteId = useId();
  const toExternal = ledger === "jvb";
  const target = toExternal ? "external" : "jvb";

  if (!confirming) {
    return (
      <Button variant="quiet" size="sm" onClick={() => setConfirming(true)} className="-ml-1.5">
        {toExternal ? "Move to Not JvdB" : "Move to JvdB stock"}
      </Button>
    );
  }

  return (
    <form action={action} className="panel mt-2 max-w-[440px]">
      <input type="hidden" name="to" value={target} />
      <p className="text-[13px] leading-[1.45] text-body">
        {toExternal ? (
          <>
            Move <span className="tabular">{stockNumber}</span> into the Not-JvdB register. The
            record keeps its images, documents, lists and history, but it is issued a new{" "}
            <span className="tabular">X-</span> number and{" "}
            <span className="tabular">{stockNumber}</span> is set aside. It will no longer appear
            in the stock book.
          </>
        ) : (
          <>
            Move <span className="tabular">{stockNumber}</span> into JvdB stock. The record keeps
            everything it has, is issued a regular stock number, and{" "}
            <span className="tabular">{stockNumber}</span> is set aside. It will start appearing
            in the stock book.
          </>
        )}
      </p>
      {/*
        Worth saying at the point of decision: the number is set aside rather
        than burnt, so this is recoverable if it turns out to be the wrong call.
      */}
      <p className="mt-1.5 text-[12px] leading-[1.4] text-meta">
        Reversible: moving it back returns the record to{" "}
        <span className="tabular">{stockNumber}</span>.
      </p>
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor={noteId} className="label">
          Why (optional)
        </label>
        <input
          id={noteId}
          name="note"
          placeholder="For example, bought in from the owner"
          className="field"
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" pendingLabel="Moving…">
          Move it
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
