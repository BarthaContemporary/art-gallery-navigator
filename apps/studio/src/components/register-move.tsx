"use client";

import { useState } from "react";

/**
 * Move a record between the JvdB register and the non-JvdB one.
 *
 * This is the one action in the app that retires a stock number, so it does not
 * sit in the autosaving edit form where a mis-click would fire it silently. It
 * asks first, and the question names the exact consequence — which number is
 * retired and roughly what replaces it — rather than a generic "are you sure".
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
  const toExternal = ledger === "jvb";
  const target = toExternal ? "external" : "jvb";

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11.5px] font-medium text-ink-soft underline decoration-line underline-offset-2 hover:text-ink-strong"
      >
        {toExternal ? "Move to Not JvdB" : "Move to JvdB stock"}
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 max-w-[420px] rounded-[10px] border border-line bg-band p-3">
      <input type="hidden" name="to" value={target} />
      <p className="text-[12.5px] leading-snug text-ink-body">
        {toExternal ? (
          <>
            Move <span className="font-mono">{stockNumber}</span> into the Not-JvdB register. The
            record keeps its images, documents, lists and history, but it is issued a new{" "}
            <span className="font-mono">X-</span> number and{" "}
            <span className="font-mono">{stockNumber}</span> is retired. It will no longer appear in
            the stock book.
          </>
        ) : (
          <>
            Move <span className="font-mono">{stockNumber}</span> into JvdB stock. The record keeps
            everything it has, is issued a regular stock number, and{" "}
            <span className="font-mono">{stockNumber}</span> is retired. It will start appearing in
            the stock book.
          </>
        )}
      </p>
      <input
        name="note"
        placeholder="Why (optional) — e.g. bought in from the owner"
        className="mt-2.5 block w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13px] text-ink-body"
      />
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="submit"
          className="min-h-[36px] rounded-lg border border-oranje bg-oranje/10 px-3 text-[12px] font-semibold text-oranje"
        >
          Move it
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[12px] font-medium text-ink-mid hover:text-ink-strong"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
