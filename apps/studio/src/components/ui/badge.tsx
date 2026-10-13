/*
 * Badges (spec section 4): a state in a word. The tone colours it; the word
 * carries it, so a badge never relies on colour alone (spec R4).
 *
 *   <Badge tone? variant? size? caps? title? className?>{word}</Badge>
 *     variant "tag" (default): a square tag, 20px high, 11px/500. Neutral is
 *             body on band; ok/warn/danger/info are the tone on its wash.
 *             For record headers and anywhere a state should stand out.
 *             "dot": a 6px dot in the tone plus the word in body, at the
 *             size of the line it sits in (13px in a table row), for dense
 *             rows and secondary lines. hollow draws the dot as a ring (a
 *             state that is "not": not on the website, not started).
 *     size    "md" (default) | "xs" (16px, 10px text) for a tag inside a
 *             line of small text.
 *     caps    uppercase with tracking (register marks like "Not JvdB").
 *     tone    "neutral" (default) | "ok" | "warn" | "danger" | "info".
 *             Take it from lib/labels (STATUS_TONES) rather than choosing per
 *             page, and the word from the matching label map.
 *
 *   <StatusBadge status variant?>  a work's status word and tone from
 *     lib/labels. StatusPill (components/status-pill) wraps it.
 *
 * Server-safe.
 */
import type { ReactNode } from "react";
import { STATUS_LABELS, STATUS_TONES, labelOf, type Tone } from "@/lib/labels";
import { cx } from "./cx";

export type { Tone };

const DOT: Record<Tone, string> = {
  neutral: "var(--jvb-meta)",
  ok: "var(--jvb-ok)",
  warn: "var(--jvb-warn)",
  danger: "var(--jvb-danger)",
  info: "var(--jvb-info)",
};

export function Badge({
  tone = "neutral",
  variant = "tag",
  size = "md",
  caps = false,
  hollow = false,
  title,
  className,
  children,
}: {
  tone?: Tone;
  variant?: "tag" | "dot";
  size?: "md" | "xs";
  caps?: boolean;
  hollow?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "dot") {
    return (
      <span title={title} className={cx("inline-flex items-center gap-1.5 text-body", className)}>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={hollow ? { border: `1.5px solid ${DOT[tone]}` } : { background: DOT[tone] }}
        />
        {children}
      </span>
    );
  }
  return (
    <span
      title={title}
      data-tone={tone === "neutral" ? undefined : tone}
      className={cx("badge", caps && "badge-caps", size === "xs" && "badge-xs", className)}
    >
      {children}
    </span>
  );
}

/** A work's status (pieces.status) in its word and tone. */
export function StatusBadge({ status, variant = "tag" }: { status: string; variant?: "tag" | "dot" }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} variant={variant}>
      {labelOf(STATUS_LABELS, status)}
    </Badge>
  );
}
