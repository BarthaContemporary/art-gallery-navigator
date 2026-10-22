/*
 * The Moon Gate: the gallery's mark (mark 4a, the favicon and app icon of
 * the website and the studio), drawn for the interface, and the loader built
 * from it.
 *
 * Geometry from the icon master (viewBox 0 0 280 280): an ink square from 52
 * to 228 with square notches cut at its top-left and bottom-right corners, a
 * paper circle of r48 at the centre (the moon gate) and a seal dot of r12.
 * Here the square is drawn in currentColor with the gate cut out of it
 * (even-odd), so whatever is behind shows through in either theme, and the
 * seal is the interface accent (the icon artwork's #fc6600 stays in the icon
 * files, see --jvb-brand-seal in tokens.css).
 *
 *   <MoonGateMark size? title? pulse? className? style?>
 *     size   px, default 20.
 *     title  only where the mark stands alone and means something; it then
 *            gets role="img" and is announced. Decorative (aria-hidden) by
 *            default, as beside the wordmark.
 *     pulse  "hover": the seal pulses once when the nearest .mg-hover
 *            ancestor (or the mark) is hovered, as in the header.
 *            "loop": the seal breathes while something loads (the app
 *            loading state). Both still under reduced motion.
 *     The colour of the square comes from the text colour.
 *
 *   <MoonGateLoader size? className?>
 *     The pending mark: the gate's ring with a turning arc and the seal
 *     pulsing at its centre. Decorative: the control or region that shows
 *     it says what is happening (aria-busy, a pending label, role="status").
 *     The one infinite animation in the studio; reduced motion stills it.
 *
 * Server-safe. Styles: .mg-* in app/globals.css.
 */
import type { CSSProperties } from "react";
import { cx } from "./cx";

/** The notched square with the gate cut out, in the master's coordinates. */
const GATE_PATH = "M66 52H228V214H214V228H52V66H66Z M140 92a48 48 0 1 0 0 96a48 48 0 1 0 0 -96Z";

export function MoonGateMark({
  size = 20,
  title,
  pulse,
  className,
  style,
}: {
  size?: number;
  title?: string;
  pulse?: "hover" | "loop";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="52 52 176 176"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cx("mg-mark", pulse === "hover" && "mg-pulse-hover", pulse === "loop" && "mg-pulse-loop", className)}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" fillRule="evenodd" d={GATE_PATH} />
      <circle className="mg-seal" cx="140" cy="140" r="12" />
    </svg>
  );
}

export function MoonGateLoader({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={cx("mg-loader", className)}
    >
      <circle className="mg-loader-ring" cx="8" cy="8" r="6.2" />
      <circle className="mg-loader-arc" cx="8" cy="8" r="6.2" pathLength={100} />
      <circle className="mg-loader-seal" cx="8" cy="8" r="2" />
    </svg>
  );
}
