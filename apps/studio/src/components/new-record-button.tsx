"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "New record" with a hold-to-vary accelerator.
 *
 * A tap creates JvdB stock. Holding the button for HOLD_MS retitles it to
 * "New non-JvdB record" and releasing then creates the work in the non-JvdB
 * register instead — filing someone else's work without first going to the
 * inventory filter or the new-record page.
 *
 * The register has to be settled before the draft is inserted, not after: the
 * stock number is assigned by an insert trigger, so a non-JvdB work must go
 * into external_pieces from the start to take an X- number. That is why this
 * sets a hidden field and submits, rather than creating and then moving.
 *
 * A hold is a pointer gesture with no keyboard equivalent, so it is only ever
 * a shortcut — /inventory/new asks for the register outright, and the
 * inventory list has a register filter. Nothing here is the only way through.
 */

/** How long the button must be held before it switches register. */
const HOLD_MS = 500;

export function NewRecordButton({
  action,
  className,
}: {
  action: (formData: FormData) => void;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const ledgerRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `armed` is what the release acts on; `holding` only drives the fill.
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    setArmed(false);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return; // left button only
    // Capture so the release is still delivered here if the pointer has moved
    // off the button. Moving off cancels the hold (see onPointerLeave), so the
    // captured release lands on holding === false and submits nothing — which
    // is the escape hatch: slide away to back out.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setHolding(true);
    setArmed(false);
    timer.current = setTimeout(() => {
      setArmed(true);
      // A short tick confirms the switch on a phone, where the label change is
      // under the user's own thumb.
      navigator.vibrate?.(10);
    }, HOLD_MS);
  }

  function onPointerUp() {
    if (!holding) return;
    const external = armed;
    reset();
    if (ledgerRef.current) ledgerRef.current.value = external ? "external" : "jvb";
    // Set the field imperatively and submit in the same tick — going through
    // state would risk submitting the previous value.
    formRef.current?.requestSubmit();
  }

  return (
    <form action={action} ref={formRef}>
      <input type="hidden" name="ledger" defaultValue="jvb" ref={ledgerRef} />
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onPointerLeave={reset}
        // A long press on touch otherwise raises the selection callout.
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Keyboard gets the plain action; there is no held-key equivalent.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (ledgerRef.current) ledgerRef.current.value = "jvb";
            formRef.current?.requestSubmit();
          }
        }}
        aria-describedby="new-record-hold-hint"
        className={`relative isolate overflow-hidden touch-none select-none ${
          className ??
          "rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg"
        }`}
      >
        {/*
          The fill is the only cue for how long is long enough. It grows over
          exactly HOLD_MS so reaching the far edge and the label changing are
          the same moment.

          Dropped entirely under reduced motion rather than left to the global
          `transition-duration: 0.01ms !important`, which would snap it to full
          width on touch — reading as armed a half-second before it is. The
          label swap carries the interaction on its own.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 -z-10 bg-black/20 motion-reduce:hidden"
          style={{
            width: holding ? "100%" : 0,
            transition: holding ? `width ${HOLD_MS}ms linear` : "width 120ms ease-out",
          }}
        />
        {armed ? "New non-JvdB record" : "New record"}
      </button>

      {/*
        Announced on change rather than shown: sighted users get the label
        swap, and the live region keeps a screen-reader user informed if they
        happen to trigger the hold.
      */}
      <span className="sr-only" aria-live="polite">
        {armed ? "Release to create a non-JvdB record" : ""}
      </span>
      <span id="new-record-hold-hint" className="sr-only">
        Creates a JvdB stock record. Hold the button to create a non-JvdB record
        instead.
      </span>
    </form>
  );
}
