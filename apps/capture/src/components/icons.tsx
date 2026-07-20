/**
 * Monochrome line icons for the capture app. All inherit the current text
 * colour (so `text-*` utilities tint them) and default to 1.4rem square.
 * Thin 1.6 strokes, round caps — in keeping with the ink-on-paper mark.
 */
import type { SVGProps } from "react";

function Svg({ className, children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "h-5 w-5"}
      {...rest}
    >
      {children}
    </svg>
  );
}

export type IconProps = { className?: string };

/** Works / artwork — a framed picture. */
export function IconArtwork(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M5 16.5 10 11.5l3 3L16 11l3 3.5" />
    </Svg>
  );
}

/** Invoice / receipt. */
export function IconReceipt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 4h12v15l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3V4Z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4" />
    </Svg>
  );
}

/** Push to inventory — arrow dropping into a tray. */
export function IconPush(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 14v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 17v-3" />
      <path d="M12 4v9" />
      <path d="M8.5 9.5 12 13l3.5-3.5" />
    </Svg>
  );
}

/** Contact / person. */
export function IconUser(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}

/** Camera. */
export function IconCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8.8A1.5 1.5 0 0 1 5.5 7.3H8l1.1-1.7a1 1 0 0 1 .84-.45h4.12a1 1 0 0 1 .84.45L16 7.3h2.5A1.5 1.5 0 0 1 20 8.8v8.4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.2Z" />
      <circle cx="12" cy="13" r="3.1" />
    </Svg>
  );
}

/** Business card / ID. */
export function IconIdCard(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M6.2 15.2a2.6 2.6 0 0 1 4.6 0" />
      <path d="M13.5 10h4" />
      <path d="M13.5 13.5h4" />
    </Svg>
  );
}

/** Passkey / key. */
export function IconKey(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8.3" cy="8.3" r="3.4" />
      <path d="M10.7 10.7 19 19" />
      <path d="M15.6 15.6 17.4 13.8" />
      <path d="M17.6 17.6 19.4 15.8" />
    </Svg>
  );
}

/** Check. */
export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Svg>
  );
}

/** Close / remove. */
export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  );
}

/** Chevron (right by default). */
export function IconChevron(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

/** Trash. */
export function IconTrash(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4L16.5 7" />
    </Svg>
  );
}
