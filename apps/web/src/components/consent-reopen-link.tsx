"use client";

import { useConsent } from "@/components/consent-provider";

/**
 * Footer control for revisiting the cookie decision. Withdrawal must be as
 * easy to reach as the original choice was, so it lives permanently in the
 * footer beside the policies rather than behind a settings page.
 *
 * `reopen()` clears the stored record first, so the withdrawal takes effect
 * immediately — a visitor who clicks this and then closes the tab has still
 * revoked consent.
 */
export function ConsentReopenLink() {
  const { reopen } = useConsent();
  return (
    <button type="button" onClick={reopen} className="link-inline text-left">
      Cookie choices
    </button>
  );
}
