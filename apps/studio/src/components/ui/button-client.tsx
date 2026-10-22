"use client";

import { useFormStatus } from "react-dom";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";
import { MoonGateLoader } from "./moon-gate";

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
   * Shows the pending state (disabled, aria-busy, the Moon Gate loader and
   * pendingLabel) for work the caller tracks itself, such as a fetch. A
   * type="submit" button inside a <form> also turns pending by itself while
   * the form's action runs.
   */
  pending?: boolean;
  /** Replaces the children while pending: "Saving…", "Sending…". */
  pendingLabel?: ReactNode;
  /** Lets a long label wrap onto more lines (see buttonClass). */
  wrap?: boolean;
  children?: ReactNode;
} & Labelled;

/**
 * The studio's button: a native <button> with the .btn classes. Everything
 * not listed above (name, value, form, onClick, formAction, aria-*) passes
 * straight through, so form data and handlers are exactly what the caller
 * wrote. type defaults to "button", so a button inside a form never submits
 * it by accident; pass type="submit" for the one that should.
 *
 * The content sits in a .btn-label span (the part the primary's label
 * motion moves). While pending, the Moon Gate loader takes the leading
 * icon's place (or the icon-only button's icon), and pendingLabel replaces
 * the words.
 */
export function Button({
  variant,
  size,
  iconOnly,
  label,
  icon,
  pending,
  pendingLabel,
  wrap,
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
  const loader = busy ? <MoonGateLoader size={size === "sm" ? 12 : 14} /> : null;
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-label={iconOnly ? label : rest["aria-label"]}
      title={title ?? (iconOnly ? label : undefined)}
      className={buttonClass({ variant, size, iconOnly, wrap }, className)}
    >
      {iconOnly ? (
        (loader ?? (
          <>
            {icon}
            {children}
          </>
        ))
      ) : (
        <span className="btn-label">
          {loader ?? icon}
          {busy && pendingLabel !== undefined ? pendingLabel : children}
        </span>
      )}
    </button>
  );
}
