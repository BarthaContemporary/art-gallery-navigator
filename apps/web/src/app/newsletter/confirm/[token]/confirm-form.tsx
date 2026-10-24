"use client";

import { useState } from "react";

/**
 * The "Confirm subscription" button. A plain form post, so it works without
 * JavaScript; with it, the button is switched off once pressed, so a double
 * click sends one confirmation rather than two.
 */
export function ConfirmForm({ token }: { token: string }) {
  const [sending, setSending] = useState(false);
  return (
    <form method="post" action="/newsletter/confirm" className="mt-8" onSubmit={() => setSending(true)}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="btn btn-filled disabled:opacity-60" disabled={sending}>
        {sending ? "Confirming…" : "Confirm subscription"}
      </button>
    </form>
  );
}
