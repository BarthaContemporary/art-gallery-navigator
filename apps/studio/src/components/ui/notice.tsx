/*
 * Notices (spec section 4): a tone wash, a 3px rule in the tone, text in body.
 * The tone is never the only signal; the words say what happened.
 *
 *   <Notice tone? title? action? inline? className? id?>{children}</Notice>
 *     tone    "info" (default) a neutral fact; "ok" saved or done; "warn"
 *             needs attention; "danger" an error; "neutral" no tone at all.
 *             danger is role="alert" (announced at once), the rest
 *             role="status".
 *     title   a short bold first line.
 *     action  a control on the right (a Retry button, a link).
 *     inline  the compact form, for inside a row or next to a control.
 *
 *   <FlashNotice searchParams codes? fallback?>
 *     The message a redirect left in the URL, as a Notice, or nothing.
 *     Server actions redirect with ?error=<message> (danger) or
 *     ?notice=<message> (ok); every page reads those. `codes` adds the
 *     bespoke codes of two pages:
 *       "campaign"  the newsletter page: sent, skipped, failed, left, reason,
 *                   test, and err=nokey|nolist|nosubject|testfail|already|
 *                   sending|noeligible|sendfail.
 *       "offer"     the offer page: sent=<n>|nokey|noitems, skipped, failed,
 *                   reason.
 *     fallback: shown when the URL carries no message (the newsletter page's
 *     "being sent" and "partly sent" lines, which come from the database).
 *     Pass the page's awaited searchParams object as it is.
 *
 * Server-safe: no hooks, so a server page renders FlashNotice directly.
 */
import type { ReactNode } from "react";
import { describeEmailError } from "@/lib/email-errors";
import { cx } from "./cx";

export type NoticeTone = "info" | "ok" | "warn" | "danger" | "neutral";

export function Notice({
  tone = "info",
  title,
  action,
  inline = false,
  className,
  id,
  children,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  action?: ReactNode;
  inline?: boolean;
  className?: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      data-tone={tone}
      className={cx("notice", inline && "notice-inline", className)}
    >
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        {children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

type SearchParams = Record<string, string | string[] | undefined>;
type Flash = { tone: NoticeTone; text: string };

function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function plural(n: string | number, word: string): string {
  return `${n} ${word}${String(n) === "1" ? "" : "s"}`;
}

/** The newsletter page's codes (crm/campaigns/[id]), in the words it uses. */
function campaignFlash(sp: SearchParams): Flash | null {
  const sent = one(sp, "sent");
  const skipped = one(sp, "skipped");
  const failed = Number(one(sp, "failed") ?? 0);
  const left = Number(one(sp, "left") ?? 0);
  const reason = one(sp, "reason");
  if (sent !== undefined) {
    const parts = [`Sent to ${plural(sent, "recipient")}`];
    if (skipped && skipped !== "0") parts.push(`${skipped} skipped (no consent or no email)`);
    if (failed > 0) parts.push(`${failed} failed (${describeEmailError(reason)})`);
    const tail = left > 0 ? `. ${left} still to send: press Resume sending to continue.` : ".";
    return { tone: failed > 0 || left > 0 ? "warn" : "ok", text: parts.join(" · ") + tail };
  }
  const test = one(sp, "test");
  if (test) return { tone: "ok", text: `Test sent to ${test}.` };
  switch (one(sp, "err")) {
    case "nokey":
      return { tone: "danger", text: "No RESEND_API_KEY configured. Set it to send." };
    case "nolist":
      return { tone: "danger", text: "Choose an audience list before sending." };
    case "nosubject":
      return { tone: "danger", text: "Add a subject line before sending." };
    case "testfail":
      return {
        tone: "danger",
        text: `Test send failed (${describeEmailError(reason)}). Check the From address and API key.`,
      };
    case "already":
      return { tone: "info", text: "This newsletter has already been sent." };
    case "sending":
      return { tone: "info", text: "This newsletter is already being sent. Reload in a minute to see the result." };
    case "noeligible":
      return {
        tone: "danger",
        text: "Nobody on this list can be mailed: each needs an email address and marketing consent, and must not be unsubscribed or marked do not mail.",
      };
    case "sendfail":
      return {
        tone: "danger",
        text: "Sending stopped on an error. Everyone already mailed is recorded and will not be mailed again: press Resume sending to continue.",
      };
    default:
      return null;
  }
}

/** The offer page's codes (offers/[id]). */
function offerFlash(sp: SearchParams): Flash | null {
  const sent = one(sp, "sent");
  if (!sent) return null;
  if (sent === "nokey") return { tone: "danger", text: "No RESEND_API_KEY configured. Set it to send offers." };
  if (sent === "noitems") return { tone: "danger", text: "Add at least one work before sending." };
  const skipped = one(sp, "skipped");
  const failed = one(sp, "failed");
  const parts = [`Sent ${plural(sent, "email")}`];
  if (skipped && skipped !== "0") parts.push(`${skipped} skipped`);
  const hasFailed = Boolean(failed && failed !== "0");
  if (hasFailed) {
    parts.push(
      `${failed} failed (${describeEmailError(one(sp, "reason"))}). They are still unsent: press Send again to retry them`,
    );
  }
  return { tone: hasFailed ? "warn" : "ok", text: parts.join(" · ") + "." };
}

export function FlashNotice({
  searchParams,
  codes,
  fallback = null,
  className,
}: {
  searchParams: SearchParams;
  codes?: "campaign" | "offer";
  fallback?: ReactNode;
  className?: string;
}) {
  const error = one(searchParams, "error");
  const notice = one(searchParams, "notice");
  const flash: Flash | null = error
    ? { tone: "danger", text: error }
    : notice
      ? { tone: "ok", text: notice }
      : codes === "campaign"
        ? campaignFlash(searchParams)
        : codes === "offer"
          ? offerFlash(searchParams)
          : null;
  if (!flash) return <>{fallback}</>;
  return (
    <Notice tone={flash.tone} className={className}>
      {flash.text}
    </Notice>
  );
}
