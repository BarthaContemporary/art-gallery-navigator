"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action <form>s that shows a pending state — the
 * action disables and swaps its label while the request is in flight, so
 * mutations (send offer, add/remove, link) no longer feel dead. Autosave has
 * its own status line; this is for the discrete-action forms.
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
  const { pending } = useFormStatus();
  const base =
    variant === "primary"
      ? "rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
      : "rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-medium text-ink-mid";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${base} disabled:opacity-60 ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
