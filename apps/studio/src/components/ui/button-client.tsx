"use client";

import { useFormStatus } from "react-dom";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";

/**
 * Icon-only controls must say what they do: `iconOnly` needs a `label`,
 * which becomes the accessible name and the tooltip.
 */
export type Labelled = { iconOnly?: false; label?: undefined } | { iconOnly: true; label: string };

export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A leading icon (an icon from ./icons). For an icon-only button, pass it as children. */
  icon?: ReactNode;
  /**
   * Shows the pending state (disabled, aria-busy, pendingLabel) for work the
   * caller tracks itself, such as a fetch. A type="submit" button inside a
   * <form> also turns pending by itself while the form's action runs.
   */
  pending?: boolean;
  /** Replaces the children while pending: "Saving…", "Sending…". */
  pendingLabel?: ReactNode;
  children?: ReactNode;
} & Labelled;

/**
 * The studio's button: a native <button> with the .btn classes. Everything
 * not listed above (name, value, form, onClick, formAction, aria-*) passes
 * straight through, so form data and handlers are exactly what the caller
 * wrote. type defaults to "button", so a button inside a form never submits
 * it by accident; pass type="submit" for the one that should.
 */
export function Button({
  variant,
  size,
  iconOnly,
  label,
  icon,
  pending,
  pendingLabel,
  type = "button",
  disabled,
  className,
  title,
  children,
  ...rest
}: ButtonProps) {
  // Outside a <form>, or for a plain button, this stays { pending: false }.
  const form = useFormStatus();
  const busy = Boolean(pending) || (type === "submit" && form.pending);
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={iconOnly ? label : rest["aria-label"]}
      title={title ?? (iconOnly ? label : undefined)}
      className={buttonClass({ variant, size, iconOnly }, className)}
    >
      {icon}
      {busy && pendingLabel !== undefined && !iconOnly ? pendingLabel : children}
    </button>
  );
}
