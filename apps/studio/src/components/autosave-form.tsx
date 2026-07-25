"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Wraps a form and autosaves it (debounced) to `endpoint` via PATCH, sending the
 * form as multipart FormData. Shows a live save-status line. Used for the
 * inventory editor; mirrors the CRM contact editor's behaviour.
 */
export function AutosaveForm({
  endpoint,
  children,
  className,
}: {
  endpoint: string;
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempt = useRef(0);
  const dirty = useRef(false);
  const [status, setStatus] = useState<Status>("idle");

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

  const save = useCallback(async () => {
    if (!formRef.current) return;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setStatus("saving");
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        body: new FormData(formRef.current),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Success — clear the failure streak and mark everything persisted.
      attempt.current = 0;
      dirty.current = false;
      setStatus("saved");
    } catch {
      // Keep the unsaved changes in the (still-mounted) form and retry with a
      // capped exponential backoff, so a dropped connection self-heals without
      // the dealer re-typing. 2s → 4s → 8s → 16s → 30s.
      setStatus("error");
      attempt.current += 1;
      const delay = Math.min(2000 * 2 ** (attempt.current - 1), 30000);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => void save(), delay);
    }
  }, [endpoint]);

  const scheduleSave = useCallback(() => {
    dirty.current = true;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  }, [save]);

  // When the network comes back, retry straight away instead of waiting out the
  // backoff; a beat later a successful save clears the warning.
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current) void save();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [save]);

  // Last-ditch flush if the tab is hidden or unloaded with changes still
  // pending — keepalive lets the PATCH outlive the page.
  useEffect(() => {
    const onLeave = () => {
      if (!dirty.current || !formRef.current) return;
      try {
        void fetch(endpoint, {
          method: "PATCH",
          body: new FormData(formRef.current),
          keepalive: true,
        });
      } catch {
        /* best-effort */
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onLeave();
    };
    window.addEventListener("pagehide", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endpoint]);

  // Clear timers on unmount.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // Flush immediately when focus leaves a field — so stepping out to "Manage
  // shipments" / "Manage temporary exports" (links outside this form) never
  // loses the in-progress entry to a pending debounce.
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void save();
  }, [save]);

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved ✓"
        : status === "error"
          ? "Couldn’t save — your changes are kept and will retry automatically"
          : "Autosave on — changes save automatically";

  return (
    <form
      ref={formRef}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onBlur={flush}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }}
      className={className}
    >
      <p
        style={{ top: "var(--app-header-h, 88px)" }}
        className={`sticky z-10 mb-3 flex items-center gap-2 text-[12px] transition-all duration-200 md:translate-y-0 md:opacity-100 ${
          hidden ? "-translate-y-3 opacity-0" : "translate-y-0 opacity-100"
        } ${
          status === "error"
            ? "text-oranje"
            : status === "saved"
              ? "text-status-green"
              : "text-ink-soft"
        }`}
        aria-live="polite"
      >
        {statusText}
        {status === "error" ? (
          <button
            type="button"
            onClick={() => {
              attempt.current = 0;
              void save();
            }}
            className="rounded-md border border-oranje/40 px-2 py-0.5 text-[11px] font-medium text-oranje hover:bg-oranje/10"
          >
            Retry now
          </button>
        ) : null}
      </p>
      {children}
    </form>
  );
}
