/*
 * Website state for works, makers and lists (spec section 4). One mark
 * everywhere: an ok-filled dot with "On website", or a hollow ring with
 * "Not on website". The word always comes with it.
 *
 *   <WebsiteSwitch on onLabel? offLabel? size? …Button props>
 *     The control that puts a thing on the site or takes it off: a Button
 *     with role="switch" and aria-checked. It holds no state: the caller
 *     flips `on` (from its own state or the server's answer). type defaults
 *     to "button"; pass type="submit" (with the form's hidden fields) for a
 *     server-action toggle, which then shows the pending state by itself.
 *     onLabel/offLabel replace the words ("List on website" / "Not on
 *     website") where the thing needs naming. size defaults to "sm".
 *
 *   <WebsiteDot on wordless? className?>
 *     The read-only mark for a row or a header, at the size of its line.
 *     wordless keeps the word for
 *     screen readers and as a tooltip only; use it just in a column headed
 *     "Website", where the heading says what the mark means.
 *
 * Server-safe (the Button inside is a client component).
 */
import { Button, type ButtonProps } from "./button";
import { cx } from "./cx";

function Mark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={on ? { background: "var(--jvb-ok)" } : { border: "1.5px solid var(--jvb-light)" }}
    />
  );
}

export function WebsiteSwitch({
  on,
  onLabel = "On website",
  offLabel = "Not on website",
  size = "sm",
  ...rest
}: Omit<ButtonProps, "children" | "iconOnly" | "label" | "role" | "aria-checked" | "icon"> & {
  on: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <Button {...rest} size={size} role="switch" aria-checked={on} icon={<Mark on={on} />}>
      {on ? onLabel : offLabel}
    </Button>
  );
}

export function WebsiteDot({ on, wordless = false, className }: { on: boolean; wordless?: boolean; className?: string }) {
  const word = on ? "On website" : "Not on website";
  return (
    <span
      title={wordless ? word : undefined}
      // relative: the hidden word is absolutely positioned (sr-only); inside a
      // sideways-scrolling table it must not escape the frame and widen the page.
      className={cx("relative inline-flex items-center gap-1.5 text-body", className)}
    >
      <Mark on={on} />
      <span className={wordless ? "sr-only" : undefined}>{word}</span>
    </span>
  );
}
