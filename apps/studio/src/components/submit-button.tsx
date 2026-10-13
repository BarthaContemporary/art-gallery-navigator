"use client";

import { Button } from "@/components/ui/button";

/**
 * Submit button for server-action <form>s that shows a pending state — the
 * action disables and swaps its label while the request is in flight, so
 * mutations (send offer, add/remove, link) no longer feel dead. Autosave has
 * its own status line; this is for the discrete-action forms.
 *
 * Now a thin wrapper of the shared Button (components/ui/button), which is
 * pending-aware for every type="submit"; kept so existing callers need no
 * change. "ghost" is the secondary look. New code uses
 * <Button type="submit" pendingLabel="…"> directly.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant={variant === "primary" ? "primary" : "secondary"}
      pendingLabel={pendingLabel}
      disabled={disabled}
      className={className || undefined}
    >
      {children}
    </Button>
  );
}
