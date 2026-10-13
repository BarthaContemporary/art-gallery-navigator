"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

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
 * form as multipart FormData. Shows a live save-status line. Used for the
 * inventory editor; mirrors the CRM contact editor's behaviour.
 */
export function AutosaveForm({
  endpoint,
  children,
  className,
  doneHref,
}: {
  endpoint: string;
  children: ReactNode;
  className?: string;
  /** When set, a "Done" button saves any pending edits, waits for them, then navigates here. */
  doneHref?: string;
}) {
  const router = useRouter();
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
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    mounted.current = true;
    if (formRef.current && lastSaved.current === null) lastSaved.current = serialise(formRef.current);
    return () => {
      mounted.current = false;
    };
  }, []);

  // On small screens the sticky autosave line eats scarce vertical space, so
  // slide it away when the user scrolls down and bring it back on scroll up.
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

  // Last-ditch flush if the tab is hidden or unloaded with changes still
  // pending — keepalive lets the PATCH outlive the page. Called with `true`
  // when the editor is left inside the app: the page lives on, so it waits
  // for a save already on the wire, which could otherwise land after this
  // newer one and undo it. A closing tab cannot wait and sends at once. (As
  // an event listener it receives the Event, hence the strict check.)
  const flushOnLeave = useCallback(
    (afterInFlight?: unknown) => {
      if (!dirty.current || !formRef.current) return;
      const body = new FormData(formRef.current);
      const send = () => {
        try {
          void fetch(endpoint, { method: "PATCH", body, keepalive: true });
        } catch {
          /* best-effort */
        }
      };
      if (afterInFlight === true && inFlight.current) void inFlight.current.finally(send);
      else send();
    },
    [endpoint],
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
        setFailing(false);
        setSignedOut(false);
        setStatus("saved");
        return true;
      }
      setStatus("saving");
      let lapsed = false;
      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          body: new FormData(formRef.current),
        });
        // A lapsed session answers 401 (middleware). Should a redirect to the
        // sign-in page ever be followed instead, its 200 is not a save either.
        const toLogin = res.redirected && new URL(res.url).pathname.startsWith("/login");
        if (res.status === 401 || toLogin) {
          lapsed = true;
          throw new Error("signed out");
        }
        if (!res.ok) throw new Error(String(res.status));
        // Success — clear the failure streak and mark everything persisted.
        attempt.current = 0;
        lastSaved.current = sent;
        // Edits typed while this PATCH was on the wire are still unsaved;
        // their own debounced save follows.
        dirty.current = formRef.current ? serialise(formRef.current) !== sent : false;
        setFailing(false);
        setSignedOut(false);
        setStatus("saved");
        return true;
      } catch {
        // Keep the unsaved changes in the (still-mounted) form and retry with a
        // capped exponential backoff, so a dropped connection self-heals without
        // the dealer re-typing. 2s → 4s → 8s → 16s → 30s.
        setStatus("error");
        setFailing(true);
        setSignedOut(lapsed);
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
      }
    };
    const run = (inFlight.current ?? Promise.resolve(true)).then(attemptSave, attemptSave);
    inFlight.current = run;
    void run.finally(() => {
      if (inFlight.current === run) inFlight.current = null;
    });
    return run;
  }, [endpoint, flushOnLeave]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
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
  // tab) does the same.
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current) void save();
    };
    const onFocus = () => {
      if (dirty.current && attempt.current > 0) void save();
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
  // holding (a pending debounce or retry) instead of dropping them.
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
      if (waiting) flushOnLeaveRef.current(true);
    },
    [],
  );

  // While a save is failing, leaving would lose the edits: ask first, for
  // links (in-app navigation never reaches beforeunload) and for closing or
  // reloading the tab.
  useEffect(() => {
    if (!failing) return;
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
  }, [failing]);

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

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved ✓"
        : status === "error"
          ? signedOut
            ? "Signed out. Your changes are kept here and save once you sign in again."
            : "Couldn’t save — your changes are kept and will retry automatically"
          : "Autosave on — changes save automatically";

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
      <div
        style={{ top: "var(--app-header-h, 88px)" }}
        className={`sticky z-10 mb-3 flex items-center gap-2 transition-all duration-200 md:translate-y-0 md:opacity-100 ${
          hidden ? "-translate-y-3 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <span
          className={`flex items-center gap-2 text-[12px] ${
            status === "error"
              ? "text-danger"
              : status === "saved"
                ? "text-status-green"
                : "text-ink-soft"
          }`}
          aria-live="polite"
        >
          {statusText}
          {status === "error" && signedOut ? (
            // A new tab, so this page and its unsaved edits stay put; the
            // next retry, or coming back to this tab, saves them.
            <a
              href="/login"
              target="_blank"
              rel="noopener"
              className="font-medium underline underline-offset-2"
            >
              Sign in
            </a>
          ) : null}
          {status === "error" ? (
            <button
              type="button"
              onClick={() => {
                attempt.current = 0;
                void save();
              }}
              className="rounded-md border border-oranje/40 px-2 py-0.5 text-[11px] font-medium text-accent-deep hover:bg-oranje/10"
            >
              Retry now
            </button>
          ) : null}
        </span>
        {doneHref ? (
          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              // Leave only once the save has landed; on failure stay here
              // with the error and the kept edits.
              setLeaving(true);
              const ok = await flush();
              if (ok) router.push(doneHref);
              else setLeaving(false);
            }}
            className="ml-auto rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-fg disabled:opacity-60"
          >
            Done
          </button>
        ) : null}
      </div>
      {children}
    </form>
  );
}
