import { cx } from "./cx";

/**
 * secondary (the default): ink edge and text; an ink wash rises on hover.
 * primary: the Moon Gate block (ink, two square notches), page text; the
 *   seal stamps in on hover and focus. At most one per view header.
 * danger: destructive actions only; the secondary pattern in danger.
 * quiet: no edge, meta text, an underline drawn on hover. On the page
 *   ground only (meta is 4.31:1 on band).
 */
export type ButtonVariant = "secondary" | "primary" | "danger" | "quiet";
/** md: 32px (44px on touch). sm: 28px (36px on touch), 12px text. */
export type ButtonSize = "md" | "sm";

export type ButtonStyle = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square, for a single icon. The component forms require a label with it. */
  iconOnly?: boolean;
  /**
   * A long label that may wrap onto a second line: the height grows from the
   * control height instead of clipping, and the text sets left. For the rare
   * sentence-length action in a narrow column; keep labels short otherwise.
   */
  wrap?: boolean;
};

/**
 * The class string for a button look, for elements the Button components do
 * not cover (a <summary>, a <label> over a file input, a submit inside a
 * component that builds its own <button>). Plain function, so server
 * components can call it.
 */
export function buttonClass(style: ButtonStyle = {}, className?: string): string {
  const { variant = "secondary", size = "md", iconOnly = false, wrap = false } = style;
  return cx(
    "btn",
    variant !== "secondary" && `btn-${variant}`,
    size === "sm" && "btn-sm",
    iconOnly && "btn-icon",
    wrap && !iconOnly && "btn-wrap",
    className,
  );
}
