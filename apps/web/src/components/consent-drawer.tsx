"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConsent } from "@/components/consent-provider";

/**
 * Consent drawer — a quiet band along the foot of the page.
 *
 * Deliberately NOT a modal. A consent notice that blocks the page is a cookie
 * wall, which the ICO does not accept and which the build spec forbids: the
 * visitor can keep reading, scrolling and navigating while it sits there.
 *
 * Compliance shape:
 *   · Accept and Decline are the same size, weight and colour — refusing is
 *     exactly as easy as agreeing, and takes the same single click.
 *   · Nothing is pre-ticked; the granular panel starts fully off.
 *   · The decision is remembered, and is re-openable from the footer.
 *   · No purpose is loaded before a decision — enforced in the gated script
 *     components, not by convention here.
 *
 * Motion: the page settles first, then the drawer rises. Slow enough to read as
 * deliberate rather than as an interruption, and skipped entirely under
 * prefers-reduced-motion.
 */
export function ConsentDrawer() {
  const { ready, decided, decide, reopenRequested } = useConsent();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const shouldShow = ready && !decided;

  // Let the page arrive before asking anything of the visitor. Reopening from
  // the footer skips the wait — that click is already an intent to decide.
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      setExpanded(false);
      return;
    }
    if (reopenRequested) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, [shouldShow, reopenRequested]);

  if (!shouldShow) return null;

  return (
    <div
      role="region"
      aria-label="Cookie choices"
      data-visible={visible ? "true" : "false"}
      className="jvb-consent fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-washi"
    >
      <div className="mx-auto flex max-w-[var(--page-max)] flex-col gap-5 px-6 py-6 md:flex-row md:items-start md:justify-between md:gap-10 md:px-16 md:py-7">
        <div className="max-w-[var(--measure)]">
          <p className="text-ui text-ink-70">
            We use analytics to understand how the collection is browsed, and marketing
            tools to reach people who may be interested in it. Neither runs unless you
            agree.{" "}
            <Link className="link-inline" href="/cookies">
              Cookie policy
            </Link>{" "}
            ·{" "}
            <Link className="link-inline" href="/privacy">
              Privacy
            </Link>
          </p>

          {expanded ? (
            <div className="mt-5 flex flex-col gap-3">
              <Choice
                checked={analytics}
                onChange={setAnalytics}
                label="Analytics"
                detail="How pages and works are viewed. Helps us show more of what people come for."
              />
              <Choice
                checked={marketing}
                onChange={setMarketing}
                label="Marketing"
                detail="Advertising pixels that let us reach comparable audiences elsewhere."
              />
            </div>
          ) : null}
        </div>

        {/* Accept and Decline are visually identical — the choice is not nudged. */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {expanded ? (
            <button type="button" onClick={() => decide({ analytics, marketing })} className="jvb-consent-btn">
              Save choices
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => decide({ analytics: false, marketing: false })}
                className="jvb-consent-btn"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => decide({ analytics: true, marketing: true })}
                className="jvb-consent-btn"
              >
                Accept
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-label uppercase tracking-[0.08em] text-ink-50 underline underline-offset-4 hover:text-sumi"
          >
            {expanded ? "Back" : "Choose"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Choice({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-4 w-4 shrink-0 accent-oranje"
      />
      <span>
        <span className="block text-ui text-sumi">{label}</span>
        <span className="block text-label text-ink-50">{detail}</span>
      </span>
    </label>
  );
}
