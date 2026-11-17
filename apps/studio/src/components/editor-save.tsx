"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SaveStatus, SaveStatusProvider, useSaveReporter, useSaveStatus } from "@/components/ui/save-status";
import { Button } from "@/components/ui/button";
import { EditSectionRail } from "@/components/edit-section-rail";
import { asOutcome, NO_ANSWER, planFlush, type SaveOutcome } from "@/lib/save-outcome";

/*
 * The record editor's one save line (W14). The main form, the consignment
 * panel, the import VAT fields and the shipment forms each save on their own,
 * and each reports into one SaveStatusProvider, so a single sticky line says
 * what is true of all of them ("Couldn’t save the consignment", with Retry).
 *
 * Done saves every part that is still holding an edit (each registers a flush
 * with useFlushForDone), then waits until nothing is on the wire, and leaves
 * only when everything landed. On a failure it stays, with the error showing.
 *
 * While any part holds edits that failed to save and will be tried again,
 * links and closing the tab ask first (useLeaveGuard, armed once here for
 * every part). A save the server refused for good (403, 404, a validation
 * error: lib/save-outcome.ts) does not arm it: a retry could not save it.
 *
 * The line and the section rail sit outside the main <form> on purpose: a
 * sticky element stops at the end of its parent, and the rail has to stay put
 * over the shipment, consignment and documents panels below the form too.
 */

type Flush = () => Promise<boolean>;
type Registry = {
  register: (id: string, flush: Flush) => () => void;
  setFailing: (id: string, failing: boolean) => void;
};
const EditorSaveContext = createContext<Registry | null>(null);

/** True inside an EditorSaveRoot: the form leaves its own status line to the root. */
export function useInEditorRoot(): boolean {
  return useContext(EditorSaveContext) !== null;
}

/**
 * Give Done a way to save this part now. `flush` resolves true once the
 * server holds what the part shows. `failing`: the part holds edits whose
 * save failed and is being retried, so leaving now would drop them; the root
 * asks before links and unload while any part says so. A no-op outside an
 * EditorSaveRoot.
 */
export function useFlushForDone(id: string, flush: Flush, failing = false) {
  const ctx = useContext(EditorSaveContext);
  const latest = useRef(flush);
  useEffect(() => {
    latest.current = flush;
  }, [flush]);
  useEffect(() => ctx?.register(id, () => latest.current()), [ctx, id]);
  useEffect(() => {
    if (!ctx) return;
    ctx.setFailing(id, failing);
    return () => ctx.setFailing(id, false);
  }, [ctx, id, failing]);
}

/**
 * While `active`, leaving the page would lose edits that have not saved:
 * ask first, for links (in-app navigation never reaches beforeunload) and
 * for closing or reloading the tab. Same-page hash links (the section
 * rail), new-tab links (Sign in), downloads and modified clicks pass.
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let confirmed = false;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      // Another site is a full page load, which beforeunload covers.
      if (to.origin !== window.location.origin) return;
      // A jump within this page (the section rail) leaves nothing.
      if (to.pathname === window.location.pathname && to.search === window.location.search && to.hash) return;
      if (window.confirm("Your latest changes have not been saved. Leave this page anyway?")) {
        confirmed = true;
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (confirmed) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [active]);
}

/**
 * On small screens a sticky save line eats scarce height: true while the
 * user is scrolling down (past the first 80 px), false again on the way up.
 */
export function useHideOnScrollDown(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > lastY + 4 && y > 80) setHidden(true);
        else if (y < lastY - 4) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

// Several parts of one editor unmount together; one refresh covers them all.
let refreshQueued = false;

/**
 * Next keeps every page it has shown in its client cache, and Back or
 * Forward put one back from there without asking the server. An editor
 * reopened that way would show the values from before its own saves, take
 * them as its baseline, and the next edit would save that stale form over
 * the saved one. So an editor that saved anything refreshes the router once
 * it has been left: refresh() rebuilds the cache from the server, dropping
 * the stale copy of the editor (and the prefetched record page Done goes
 * to), so a later Back loads it afresh.
 *
 *   const { markSaved, refreshAfterLeave } = useRefreshAfterSave();
 *   markSaved()                    after each save the server accepted
 *   refreshAfterLeave(pending?)    from the unmount cleanup, after any
 *                                  leave-save is queued: refreshes once it
 *                                  settles, if anything was saved.
 *
 * Plain browsing (nothing saved) costs no extra render.
 */
export function useRefreshAfterSave() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const saved = useRef(false);
  const markSaved = useCallback(() => {
    saved.current = true;
  }, []);
  const refreshAfterLeave = useCallback((pending?: Promise<unknown> | null) => {
    const go = () => {
      if (!saved.current || refreshQueued) return;
      refreshQueued = true;
      setTimeout(() => {
        refreshQueued = false;
        routerRef.current.refresh();
      }, 0);
    };
    if (pending) void pending.then(go, go);
    else go();
  }, []);
  return { markSaved, refreshAfterLeave };
}

export function EditorSaveRoot({
  doneHref,
  header,
  children,
}: {
  doneHref: string;
  /** The page title block, above the sticky line. */
  header: ReactNode;
  children: ReactNode;
}) {
  const flushes = useRef(new Map<string, Flush>());
  const register = useCallback((id: string, flush: Flush) => {
    flushes.current.set(id, flush);
    return () => {
      if (flushes.current.get(id) === flush) flushes.current.delete(id);
    };
  }, []);
  const [failingIds, setFailingIds] = useState<ReadonlySet<string>>(() => new Set());
  const setFailing = useCallback((id: string, failing: boolean) => {
    setFailingIds((prev) => {
      if (prev.has(id) === failing) return prev;
      const next = new Set(prev);
      if (failing) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const registry = useMemo(() => ({ register, setFailing }), [register, setFailing]);
  const flushAll = useCallback(async () => {
    const results = await Promise.all(
      [...flushes.current.values()].map((f) => f().catch(() => false)),
    );
    return results.every(Boolean);
  }, []);
  // One question before leaving, whichever parts are failing.
  useLeaveGuard(failingIds.size > 0);

  return (
    <SaveStatusProvider>
      <EditorSaveContext.Provider value={registry}>
        {/* data-rail-root: the section rail lists every titled section in here. */}
        <div data-rail-root className="max-w-[var(--jvb-measure-wide)]">
          {header}
          <EditorBar doneHref={doneHref} flushAll={flushAll} />
          {children}
        </div>
      </EditorSaveContext.Provider>
    </SaveStatusProvider>
  );
}

function EditorBar({ doneHref, flushAll }: { doneHref: string; flushAll: () => Promise<boolean> }) {
  const router = useRouter();
  const status = useSaveStatus();
  const [phase, setPhase] = useState<"idle" | "saving" | "waiting">("idle");

  async function done() {
    setPhase("saving");
    const ok = await flushAll();
    // A part could not save: stay, with its error on the line.
    setPhase(ok ? "waiting" : "idle");
  }

  // Leave once nothing is on the wire. A shipment link still posting, or a
  // part whose save was already under way, holds Done until it lands. The
  // parts that saved refresh the router as they unmount (useRefreshAfterSave).
  useEffect(() => {
    if (phase !== "waiting" || status.state === "saving") return;
    if (status.state === "error") setPhase("idle");
    else router.push(doneHref);
  }, [phase, status.state, doneHref, router]);

  // On small screens the sticky line and rail eat scarce height, so they
  // slide away while scrolling down and come back on the way up.
  const hidden = useHideOnScrollDown();

  return (
    <div
      style={{ top: "var(--app-header-h, 88px)" }}
      className={`sticky z-20 mb-6 border-b border-rule bg-page transition-[transform,opacity] duration-200 md:translate-y-0 md:opacity-100 ${
        hidden ? "pointer-events-none -translate-y-2 opacity-0 md:pointer-events-auto" : "translate-y-0 opacity-100"
      }`}
    >
      <SaveStatus sticky={false} idleText="Changes save automatically">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void done()}
          pending={phase !== "idle"}
          pendingLabel="Saving…"
        >
          Done
        </Button>
      </SaveStatus>
      <EditSectionRail />
    </div>
  );
}

type PartStatus = "idle" | "saving" | "saved" | "error";

/**
 * How a part's request is sent. `keepalive` is true only for the last-ditch
 * send when the tab is hidden or closed: the request must outlive the page,
 * and a keepalive body is capped at 64 KiB, so it is not used otherwise.
 * Answer the request's outcome (readSaveOutcome, or a plain boolean), or
 * null when the state is not valid to send (nothing goes out, and the line
 * shows the error).
 */
export type PartSend = (opts: { keepalive: boolean }) => Promise<boolean | SaveOutcome> | null;

/**
 * Autosave for an editor part that posts its React state rather than a form
 * (the consignment panel, the import VAT fields). The part calls `schedule()`
 * after each edit; 700 ms later `send` posts the state.
 *
 * `send` builds the request from the state of the render that defined it, so
 * it is always called through a ref: a debounce, a retry or Done sends what
 * the part shows now, never the values of the render that set the timer.
 *
 * Saves run one after another, so an older PATCH never lands after a newer
 * one. A save superseded by a newer one before or while it is on the wire
 * reports nothing: the newer one says what is true. A failure is tried again
 * with a capped backoff (2s, 4s, 8s … 30s), sending the latest state; a new
 * edit cancels that retry, since its own save follows. A refusal for good
 * (403, 404, a validation error) is not retried: `detail` carries the
 * server's reason for the line, and the next edit is sent as usual.
 *
 * Leaving: an edit still waiting for the debounce or a retry is sent once
 * when the part unmounts (in-app navigation; the page lives on, so it queues
 * behind a save on the wire) and with keepalive when the tab is hidden or
 * closed. `failing` says a retry is pending, for the root's leave question.
 */
export function useStateAutosave(send: PartSend) {
  const [status, setStatus] = useState<PartStatus>("idle");
  const [detail, setDetail] = useState<string | undefined>(undefined);
  const [signedOut, setSignedOut] = useState(false);
  const [failing, setFailing] = useState(false);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  // Edits made, and the edit the server holds (both counts).
  const edits = useRef(0);
  const held = useRef(0);
  // The newest save asked for, and the chain the saves run along.
  const latest = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // False once the part has unmounted: a save failing after that must not
  // re-arm a retry that would keep sending for the rest of the session.
  const alive = useRef(true);
  // The last save was refused for good; nothing resends it until an edit.
  const refused = useRef(false);
  const { markSaved, refreshAfterLeave } = useRefreshAfterSave();

  const clearTimers = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    timer.current = null;
    retryTimer.current = null;
  }, []);

  /** Save now. Resolves true once the server holds what the part shows. */
  const save = useCallback(
    (opts?: { keepalive?: boolean }): Promise<boolean> => {
      clearTimers();
      const mine = ++latest.current;
      const keepalive = opts?.keepalive === true;
      const run = async (): Promise<boolean> => {
        // A newer save was asked for while this one queued: it sends the newer state.
        if (mine !== latest.current) return true;
        const edit = edits.current;
        if (edit === held.current && attempt.current === 0) {
          setStatus("saved");
          return true;
        }
        let request: Promise<boolean | SaveOutcome> | null;
        try {
          request = sendRef.current({ keepalive });
        } catch {
          request = Promise.resolve(false);
        }
        if (request === null) {
          setStatus("error");
          setDetail(undefined);
          return false;
        }
        setStatus("saving");
        let outcome: SaveOutcome;
        try {
          outcome = asOutcome(await request);
        } catch {
          outcome = NO_ANSWER;
        }
        if (outcome.ok && edit > held.current) {
          held.current = edit;
          markSaved();
        }
        // Superseded on the wire, or edited since: the newer save reports.
        if (mine !== latest.current || edit !== edits.current) return outcome.ok;
        if (outcome.ok) {
          attempt.current = 0;
          refused.current = false;
          setStatus("saved");
          setDetail(undefined);
          setSignedOut(false);
          setFailing(false);
          return true;
        }
        setStatus("error");
        setSignedOut(Boolean(outcome.signedOut));
        if (outcome.final) {
          // Sending it again gets the same answer: say why, and stop.
          refused.current = true;
          attempt.current = 0;
          setDetail(outcome.message);
          setFailing(false);
          return false;
        }
        setDetail(undefined);
        setFailing(true);
        if (!alive.current) return false;
        attempt.current += 1;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(
          () => {
            retryTimer.current = null;
            void save();
          },
          Math.min(2000 * 2 ** (attempt.current - 1), 30000),
        );
        return false;
      };
      const result = queue.current.then(run, run);
      queue.current = result;
      return result;
    },
    [clearTimers, markSaved],
  );
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  /** After an edit: save in a moment, replacing any wait or retry pending. */
  const schedule = useCallback(() => {
    edits.current += 1;
    refused.current = false;
    clearTimers();
    setStatus("saving");
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 700);
  }, [clearTimers, save]);

  /** Anything not on the server yet that a send could still put there. */
  const unsent = useCallback(
    () => (edits.current !== held.current || attempt.current > 0) && !refused.current,
    [],
  );

  /**
   * For Done: save if anything is not on the server yet. What the server
   * refused for good is not sent again (Done stays, the reason showing)
   * until an edit.
   */
  const flush = useCallback((): Promise<boolean> => {
    const plan = planFlush({
      waiting: timer.current !== null,
      unsaved: edits.current !== held.current || attempt.current > 0,
      refused: refused.current,
    });
    if (plan === "refused") return Promise.resolve(false);
    return plan === "send" ? save() : Promise.resolve(true);
  }, [save]);

  // The tab is hidden or closing: send what is waiting now, with keepalive.
  // Hidden goes through the queue (so the debounce is not sent twice); a
  // closing page cannot wait for it and sends at once.
  useEffect(() => {
    const onPageHide = () => {
      if (!unsent()) return;
      try {
        const r = sendRef.current({ keepalive: true });
        if (r) void r.catch(() => undefined);
      } catch {
        /* best-effort */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && unsent()) void save({ keepalive: true });
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [save, unsent]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Left inside the app (a link, Back): the page lives on, so the edit a
      // timer was holding is sent once, after any save on the wire. With
      // alive false a failure re-arms nothing. (StrictMode's mount, cleanup,
      // mount in development has nothing unsent, so it sends nothing.)
      const pending = unsent();
      clearTimers();
      refreshAfterLeave(pending ? saveRef.current() : queue.current);
    };
  }, [clearTimers, unsent, refreshAfterLeave]);

  return { status, detail, signedOut, failing, save, schedule, flush };
}

/**
 * Reports a server-action form into the editor's line: "Saving…" while it
 * posts, saved once it returns. Render it inside the <form>; it reads the
 * form's pending state, so the form and what it posts are untouched. A
 * failed post still reaches the route's error boundary, as before.
 */
export function FormSaveReporter({ source }: { source: string }) {
  const report = useSaveReporter(source);
  const { pending } = useFormStatus();
  const posted = useRef(false);
  useEffect(() => {
    // Nothing to say until the form has posted once.
    if (pending) posted.current = true;
    if (posted.current) report({ state: pending ? "saving" : "saved" });
  }, [pending, report]);
  return null;
}
