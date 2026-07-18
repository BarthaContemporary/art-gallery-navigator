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
    setStatus("saving");
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        body: new FormData(formRef.current),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }, [endpoint]);

  const scheduleSave = useCallback(() => {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 800);
  }, [save]);

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "All changes saved ✓"
        : status === "error"
          ? "Couldn’t save — check your connection"
          : "Autosave on — changes save automatically";

  return (
    <form
      ref={formRef}
      onInput={scheduleSave}
      onChange={scheduleSave}
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        void save();
      }}
      className={className}
    >
      <p
        className={`sticky top-[64px] z-10 mb-3 text-[12px] transition-all duration-200 md:translate-y-0 md:opacity-100 ${
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
      </p>
      {children}
    </form>
  );
}
