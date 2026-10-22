/*
 * Buttons (spec section 4). Import from here in server and client components
 * alike.
 *
 *   <Button variant? size? icon? pending? pendingLabel? type? …button props>
 *     variant  "secondary" (default) | "primary" | "danger" | "quiet"
 *     size     "md" (default, 32px; 44px on touch) | "sm" (28px; 36px on touch)
 *     icon     a leading icon from ./icons
 *     type     "button" by default. type="submit" is pending-aware: while the
 *              surrounding form's action runs it is disabled, aria-busy, and
 *              shows pendingLabel. `pending` forces that state for work the
 *              caller tracks itself (a fetch).
 *     iconOnly + label   a square icon button; label is required and becomes
 *              aria-label and title. <Button iconOnly label="Close"><CloseIcon /></Button>
 *     wrap     a sentence-length label that may wrap: the button grows in
 *              height rather than clipping (a narrow column's one action).
 *     Every other prop (name, value, form, formAction, onClick, aria-*) is
 *     passed to the native <button> untouched.
 *
 *   <ButtonLink href variant? size? icon? disabled? native? wrap? iconOnly+label …>
 *     A link that looks like a button (next/link). `native` renders a plain
 *     <a> for downloads, API routes and new tabs. `disabled` renders an inert
 *     <span aria-disabled> in the same look.
 *
 *   buttonClass({ variant, size, iconOnly, wrap }, extra?)  the class string,
 *     for elements these do not cover.
 *
 * Destructive actions (spec R4): the first step of a standalone delete is
 * <Button variant="danger" size="sm">; inside a table or list row it is
 * <Button variant="quiet" size="sm" className="text-danger"> so a column of
 * rows is not a column of red boxes. Either way the confirm step that
 * follows keeps its own "Yes, delete" in danger.
 *
 *   SubmitButton (components/submit-button.tsx) is now a thin wrapper of
 *   Button; new code uses <Button type="submit"> directly.
 *
 * The look is the Moon Gate language in globals.css (.btn): secondary is
 * outlined in ink and fills with an ink wash rising on hover; primary is an
 * ink block with the mark's two square notches, and a seal dot stamps in
 * on hover or focus while its label eases aside; quiet draws an underline;
 * icon-only buttons move their icon. Every press scales to 0.97. Both
 * components wrap their content in a .btn-label span, which the primary's
 * label motion needs; pending shows the Moon Gate loader (MoonGateLoader in
 * ./moon-gate) in place of the leading icon.
 */
import Link from "next/link";
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";
import type { Labelled } from "./button-client";

export { Button, type ButtonProps, type Labelled } from "./button-client";
export { buttonClass, type ButtonSize, type ButtonStyle, type ButtonVariant } from "./button-class";

export type ButtonLinkProps = Omit<ComponentPropsWithRef<"a">, "href" | "children"> &
  Pick<ComponentProps<typeof Link>, "prefetch" | "replace" | "scroll"> & {
    href: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: ReactNode;
    /** Renders an inert, faded <span aria-disabled="true"> instead of a link. */
    disabled?: boolean;
    /** A plain <a> rather than next/link: file downloads, API routes, new tabs. */
    native?: boolean;
    /** Lets a long label wrap onto more lines (see buttonClass). */
    wrap?: boolean;
    children?: ReactNode;
  } & Labelled;

export function ButtonLink({
  variant,
  size,
  iconOnly,
  label,
  icon,
  disabled,
  native,
  wrap,
  prefetch,
  replace,
  scroll,
  className,
  title,
  children,
  href,
  ...rest
}: ButtonLinkProps) {
  const cls = buttonClass({ variant, size, iconOnly, wrap }, className);
  const name = iconOnly ? label : rest["aria-label"];
  const tip = title ?? (iconOnly ? label : undefined);
  const content = iconOnly ? (
    <>
      {icon}
      {children}
    </>
  ) : (
    <span className="btn-label">
      {icon}
      {children}
    </span>
  );
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={name} title={tip} className={cls}>
        {content}
      </span>
    );
  }
  if (native) {
    return (
      <a {...rest} href={href} aria-label={name} title={tip} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <Link
      {...rest}
      href={href}
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
      aria-label={name}
      title={tip}
      className={cls}
    >
      {content}
    </Link>
  );
}
