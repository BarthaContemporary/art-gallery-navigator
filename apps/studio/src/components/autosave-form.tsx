"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SaveStatus, useSaveReporter } from "@/components/ui/save-status";
import { Button } from "@/components/ui/button";
import {
  useFlushForDone,
  useHideOnScrollDown,
  useInEditorRoot,
  useLeaveGuard,
  useRefreshAfterSave,
} from "@/components/editor-save";
import { NO_ANSWER, readSaveOutcome, type SaveOutcome } from "@/lib/save-outcome";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * The form's contents as one comparable string: every FormData entry in
 * order, files by name, size and date. Equal strings mean a PATCH would send
 * exactly what the server already holds.
 */
function serialise(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  new FormData(form).forEach((value, key) => {
    entries.push([
      key,
      typeof value === "string" ? value : `file:${value.name}:${value.size}:${value.lastModified}`,
    ]);
  });
  return JSON.stringify(entries);
}

/**
 * Wraps a form and autosaves it (debounced) to `endpoint` via PATCH, sending the
 * form as multipart FormData. Shows a live save-status line (the shared
 * SaveStatus). Used for the inventory editor and the shipment page; mirrors
 * the CRM contact editor's behaviour.
 *
 * Inside an EditorSaveRoot (the record editor) the form draws no line of its
 * own: it reports into the root's one line, and the root's Done flushes it
 * along with the page's other autosaving parts.
 *
 * Answers are read with readSaveOutcome (lib/save-outcome.ts): a 401 says
 * signed out and keeps retrying; a refusal for good (403, 404, a validation
 * error) shows the server's reason, is not retried and does not ask before
 * the page is left; anything else is retried with a capped backoff.
 */
export function AutosaveForm({
  endpoint,
  children,
  className,
  doneHref,
  what,
}: {
  endpoint: string;
  children: ReactNode;
  className?: string;
  /** When set, a "Done" button saves any pending edits, waits for them, then navigates here. */
  doneHref?: string;
  /** What failed, for the status line: "the record" gives "Couldn’t save the record." */
  what?: string;
}) {
  const router = useRouter();
  const inRoot = useInEditorRoot();
  const report = useSaveReporter(endpoint);
  // The form element, kept after React detaches it on unmount so the
  // leave-flush below can still read edits that never reached the server.
  const formRef = useRef<HTMLFormElement | null>(null);
  const setFormRef = useCallback((el: HTMLFormElement | null) => {
    if (el) formRef.current = el;
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const dirty = useRef(false);
  // What the server holds: the form as first rendered, then as last saved. A
  // save whose form still equals it is skipped, so a blur or an edit undone
  // before the debounce fires doesn't stamp updated_at or queue a website sync.
  const lastSaved = useRef<string | null>(null);
  // The save on the wire, if any. Saves run one after another, so an older
  // PATCH never lands after a newer one, and Done can wait for the last.
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState<Status>("idle");
  // A save failed and its edits are still unsaved (a retry is pending or
  // running): leaving now would drop them, so links and unload ask first.
  const [failing, setFailing] = useState(false);
  // The last failure was a 401: the session lapsed and only signing in helps.
  const [signedOut, setSignedOut] = useState(false);
  // The server refused the last save for good: its reason, for the line.
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  // The same, for the event handlers: nothing resends it until an edit.
  const refused = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const { markSaved, refreshAfterLeave } = useRefreshAfterSave();

  useEffect(() => {
    mounted.current = true;
    if (formRef.current && lastSaved.current === null) lastSaved.current = serialise(formRef.current);
    return () => {
      mounted.current = false;
    };
  }, []);

  // On small screens the sticky autosave line eats scarce vertical space, so
  // slide it away when the user scrolls down and bring it back on scroll up.
  const hidden = useHideOnScrollDown();

  // Last-ditch flush if the tab is hidden or unloaded with changes still
  // pending — keepalive lets the PATCH outlive the page. Called with `true`
  // when the editor is left inside the app: the page lives on, so it waits
  // for a save already on the wire, which could otherwise land after this
  // newer one and undo it. A closing tab cannot wait and sends at once. (As
  // an event listener it receives the Event, hence the strict check.) A save
  // the server refused for good is not resent; the next edit is. Returns the
  // send, so leaving can refresh the router once it settles.
  const flushOnLeave = useCallback(
    (afterInFlight?: unknown): Promise<unknown> | null => {
      if (!dirty.current || refused.current || !formRef.current) return null;
      const body = new FormData(formRef.current);
      const send = (): Promise<unknown> => {
        try {
          return fetch(endpoint, { method: "PATCH", body, keepalive: true }).then(
            (res) => {
              if (res.ok) markSaved();
            },
            () => undefined,
          );
        } catch {
          /* best-effort */
          return Promise.resolve();
        }
      };
      if (afterInFlight === true && inFlight.current) return inFlight.current.then(send, send);
      return send();
    },
    [endpoint, markSaved],
  );

  /**
   * Save the form, queued behind any save already on the wire. Resolves true
   * once the server holds what the form shows.
   */
  const save = useCallback((): Promise<boolean> => {
    const attemptSave = async (): Promise<boolean> => {
      if (!formRef.current) return false;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      const sent = serialise(formRef.current);
      if (sent === lastSaved.current) {
        // Nothing differs from what the server holds: no PATCH.
        attempt.current = 0;
        dirty.current = false;
        refused.current = false;
        setFailing(false);
        setSignedOut(false);
        setRefusal(undefined);
        setStatus("saved");
        return true;
      }
      setStatus("saving");
      // A lapsed session answers 401 (middleware); should a redirect to the
      // sign-in page ever be followed instead, its 200 is not a save either.
      let outcome: SaveOutcome;
      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          body: new FormData(formRef.current),
        });
        outcome = await readSaveOutcome(res);
      } catch {
        outcome = NO_ANSWER;
      }
      if (outcome.ok) {
        // Success — clear the failure streak and mark everything persisted.
        attempt.current = 0;
        lastSaved.current = sent;
        refused.current = false;
        markSaved();
        // Edits typed while this PATCH was on the wire are still unsaved;
        // their own debounced save follows.
        dirty.current = formRef.current ? serialise(formRef.current) !== sent : false;
        setFailing(false);
        setSignedOut(false);
        setRefusal(undefined);
        setStatus("saved");
        return true;
      }
      setStatus("error");
      setSignedOut(Boolean(outcome.signedOut));
      if (outcome.final) {
        // Refused for good (the role may not write, the record is gone, a
        // value was not accepted): sending it again gets the same answer.
        // Say why, stop, and do not ask before leaving. The edit stays in
        // the form; the next edit is sent as usual.
        refused.current = true;
        attempt.current = 0;
        setRefusal(outcome.message);
        setFailing(false);
        return false;
      }
      // Keep the unsaved changes in the (still-mounted) form and retry with a
      // capped exponential backoff, so a dropped connection self-heals without
      // the dealer re-typing. 2s → 4s → 8s → 16s → 30s.
      setRefusal(undefined);
      setFailing(true);
      if (!mounted.current) {
        // The editor was left while this save was on the wire: one
        // keepalive attempt, no backoff loop for a page that is gone.
        flushOnLeave();
        return false;
      }
      attempt.current += 1;
      const delay = Math.min(2000 * 2 ** (attempt.current - 1), 30000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        void save();
      }, delay);
      return false;
    };
    const run = (inFlight.current ?? Promise.resolve(true)).then(attemptSave, attemptSave);
    inFlight.current = run;
    void run.finally(() => {
      if (inFlight.current === run) inFlight.current = null;
    });
    return run;
  }, [endpoint, flushOnLeave, markSaved]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    refused.current = false;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 800);
  }, [save]);

  // When the network comes back, retry straight away instead of waiting out the
  // backoff; a beat later a successful save clears the warning. Coming back to
  // this tab while a save is failing (say after signing in again in another
  // tab) does the same. A refused save is not resent.
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current && !refused.current) void save();
    };
    const onFocus = () => {
      if (dirty.current && attempt.current > 0 && !refused.current) void save();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [save]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnLeave();
    };
    window.addEventListener("pagehide", flushOnLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushOnLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushOnLeave]);

  // Leaving inside the app (a link, the back button) unmounts the form and
  // never fires pagehide. Clear the timers, but send the edits they were
  // holding (a pending debounce or retry) instead of dropping them. Once
  // that and any save on the wire settle, refresh the router if anything was
  // saved, so Back cannot reopen this editor from a stale cached copy whose
  // first edit would save the old values back (useRefreshAfterSave).
  const flushOnLeaveRef = useRef(flushOnLeave);
  useEffect(() => {
    flushOnLeaveRef.current = flushOnLeave;
  }, [flushOnLeave]);
  useEffect(
    () => () => {
      const waiting = timer.current !== null || retryTimer.current !== null;
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      timer.current = null;
      retryTimer.current = null;
      const sent = waiting ? flushOnLeaveRef.current(true) : null;
      refreshAfterLeave(sent ?? inFlight.current);
    },
    [refreshAfterLeave],
  );

  // While a save is failing (a retry is pending), leaving would lose the
  // edits: ask first. Inside an EditorSaveRoot the root asks, once for all of
  // its parts (useFlushForDone below reports `failing` to it).
  useLeaveGuard(failing && !inRoot);

  // Flush immediately when focus leaves a field — so stepping out to "Manage
  // shipments" / "Manage temporary exports" (links outside this form) never
  // loses the in-progress entry to a pending debounce. Only when something
  // changed: tabbing through the editor sends nothing.
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    } else if (!dirty.current) {
      return inFlight.current ?? Promise.resolve(true);
    }
    return save();
  }, [save]);

  const retryNow = useCallback(() => {
    attempt.current = 0;
    void save();
  }, [save]);

  // Into the editor's one line (a no-op without a SaveStatusProvider), and
  // into Done's list of parts to save before leaving. A refusal for good
  // offers no Retry: it would get the same answer.
  const onRetry = status === "error" && !refusal ? retryNow : undefined;
  useEffect(() => {
    report({ state: status, what, detail: refusal, onRetry, signedOut });
  }, [report, status, what, refusal, onRetry, signedOut]);
  useFlushForDone(endpoint, flush, failing);

  return (
    <form
      ref={setFormRef}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onBlur={() => void flush()}
      onSubmit={(e) => {
        e.preventDefault();
        void flush();
      }}
      className={className}
    >
      {inRoot ? null : (
        <SaveStatus
          state={status}
          what={what}
          detail={refusal}
          signedOut={signedOut}
          onRetry={onRetry}
          idleText="Changes save automatically"
          className={`mb-3 transition-[transform,opacity] duration-200 md:translate-y-0 md:opacity-100 ${
            hidden ? "-translate-y-3 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          {doneHref ? (
            <Button
              variant="primary"
              size="sm"
              pending={leaving}
              pendingLabel="Saving…"
              onClick={async () => {
                // Leave only once the save has landed; on failure stay here
                // with the error and the kept edits. Leaving unmounts the
                // form, which refreshes the router (see above).
                setLeaving(true);
                const ok = await flush();
                if (ok) router.push(doneHref);
                else setLeaving(false);
              }}
            >
              Done
            </Button>
          ) : null}
        </SaveStatus>
      )}
      {children}
    </form>
  );
}
