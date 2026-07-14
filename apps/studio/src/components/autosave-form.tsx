"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

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
        className={`sticky top-[64px] z-10 mb-3 text-[12px] ${
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
