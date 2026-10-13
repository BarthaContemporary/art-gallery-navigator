"use client";

/*
 * One save-status line per editor (spec section 4, W14). Every autosaving
 * part of a page (the main form, the consignment panel, the contact editor)
 * reports into one SaveStatusProvider, and a single sticky SaveStatus line
 * says what is true of all of them: an error anywhere wins, then a save in
 * progress, then "All changes saved".
 *
 *   <SaveStatusProvider>{editor}</SaveStatusProvider>
 *
 *   const report = useSaveReporter("consignment");
 *   report({ state: "saving" });
 *   report({ state: "error", what: "the consignment", onRetry: save });
 *     state     "idle" | "saving" | "saved" | "error"
 *     what      what failed, for "Couldn’t save the consignment."
 *     detail    replaces the second sentence of the error line (by default
 *               "Your changes are kept and will be tried again."): the
 *               reason for a validation error, or the truth for an editor
 *               that does not retry by itself ("Press Retry to try again.").
 *     onRetry   shows a Retry button on the error line
 *     signedOut the session lapsed: says so and links to sign in
 *     The source's report is withdrawn when it unmounts.
 *
 *   <SaveStatus sticky? idleText? className?>{actions}</SaveStatus>
 *     The line. Without a provider, or to show one source's state directly,
 *     pass state/what/onRetry/signedOut as props; they win over the context.
 *     children sit at the right (the Done button). sticky (default) pins it
 *     under the app header at var(--app-header-h). aria-live="polite".
 *
 *   useSaveStatus()  the combined report, for a Done button that must wait.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type SaveReport = {
  state: SaveState;
  what?: string;
  detail?: string;
  onRetry?: () => void;
  signedOut?: boolean;
};

const IDLE: SaveReport = { state: "idle" };

type Ctx = { current: SaveReport; report: (source: string, r: SaveReport | null) => void };
const SaveStatusContext = createContext<Ctx | null>(null);

/** Error wins, then saving, then saved; otherwise idle. */
function combine(reports: SaveReport[]): SaveReport {
  const error = reports.find((r) => r.state === "error");
  if (error) return { ...error, signedOut: reports.some((r) => r.signedOut) || undefined };
  if (reports.some((r) => r.state === "saving")) return { state: "saving" };
  if (reports.some((r) => r.state === "saved")) return { state: "saved" };
  return IDLE;
}

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Record<string, SaveReport>>({});
  const report = useCallback((source: string, r: SaveReport | null) => {
    setSources((s) => {
      if (r === null) {
        if (!(source in s)) return s;
        const next = { ...s };
        delete next[source];
        return next;
      }
      return { ...s, [source]: r };
    });
  }, []);
  const value = useMemo(() => ({ current: combine(Object.values(sources)), report }), [sources, report]);
  return <SaveStatusContext.Provider value={value}>{children}</SaveStatusContext.Provider>;
}

/** A function this source calls with its state; a no-op outside a provider. */
export function useSaveReporter(source: string): (r: SaveReport) => void {
  const ctx = useContext(SaveStatusContext);
  const report = ctx?.report;
  useEffect(() => () => report?.(source, null), [report, source]);
  return useCallback((r: SaveReport) => report?.(source, r), [report, source]);
}

export function useSaveStatus(): SaveReport {
  return useContext(SaveStatusContext)?.current ?? IDLE;
}

export function SaveStatus({
  state,
  what,
  detail,
  onRetry,
  signedOut,
  idleText = "Changes save automatically",
  sticky = true,
  className,
  children,
}: Partial<SaveReport> & {
  idleText?: string;
  sticky?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const fromContext = useSaveStatus();
  const r: SaveReport = state ? { state, what, detail, onRetry, signedOut } : fromContext;
  const text =
    r.state === "saving"
      ? "Saving…"
      : r.state === "saved"
        ? "All changes saved"
        : r.state === "error"
          ? r.signedOut
            ? "Signed out. Your changes are kept here and save once you sign in again."
            : `Couldn’t save${r.what ? ` ${r.what}` : ""}. ${r.detail ?? "Your changes are kept and will be tried again."}`
          : idleText;
  return (
    <div
      style={sticky ? { top: "var(--app-header-h, 88px)" } : undefined}
      className={cx(
        "flex min-h-[var(--jvb-control-h)] flex-wrap items-center gap-x-3 gap-y-1 bg-page py-1",
        sticky && "sticky z-10",
        className,
      )}
    >
      <p
        aria-live="polite"
        className={cx(
          "flex flex-wrap items-center gap-2 text-[12px] leading-[1.4]",
          r.state === "error" ? "text-danger" : r.state === "saved" ? "text-ok" : "text-meta",
        )}
      >
        {text}
        {r.state === "error" && r.signedOut ? (
          // A new tab, so this page and its unsaved edits stay put.
          <a href="/login" target="_blank" rel="noopener" className="font-medium underline underline-offset-2">
            Sign in
          </a>
        ) : null}
        {r.state === "error" && r.onRetry ? (
          <button type="button" onClick={r.onRetry} className="btn btn-sm btn-danger">
            Retry
          </button>
        ) : null}
      </p>
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
