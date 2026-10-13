"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useFormStatus } from "react-dom";

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
/**
 * A second release this soon after a submit is the same tap landing twice
 * (a double tap, or a bounce), not a request for a second draft. It covers the
 * moment before the form reports itself pending; after that the button is
 * disabled until the action finishes. Every draft takes a stock number.
 */
const REPEAT_MS = 600;

export function NewRecordButton({
  action,
  className,
}: {
  action: (formData: FormData) => void;
  className?: string;
}) {
  const ledgerRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action}>
      <input type="hidden" name="ledger" defaultValue="jvb" ref={ledgerRef} />
      <HoldButton ledgerRef={ledgerRef} className={className} />
    </form>
  );
}

/**
 * The button itself, inside the form so useFormStatus can see the submit in
 * flight.
 */
function HoldButton({
  ledgerRef,
  className,
}: {
  ledgerRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastSubmit = useRef(0);
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

  // Set the field imperatively and submit in the same tick — going through
  // state would risk submitting the previous value.
  function submit(ledger: "jvb" | "external") {
    const now = Date.now();
    if (pending || now - lastSubmit.current < REPEAT_MS) return;
    lastSubmit.current = now;
    if (ledgerRef.current) ledgerRef.current.value = ledger;
    buttonRef.current?.form?.requestSubmit();
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return; // left button only
    // Capture so the release is still delivered here if the pointer has moved
    // off the button. Moving off cancels the hold (see onPointerMove), so the
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

  // While the pointer is captured the browser keeps reporting it as over the
  // button, so pointerleave never fires mid-hold; test the position instead.
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!holding) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) reset();
  }

  function onPointerUp() {
    if (!holding) return;
    const external = armed;
    reset();
    submit(external ? "external" : "jvb");
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={pending}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        onPointerLeave={reset}
        // A long press on touch otherwise raises the selection callout.
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Keyboard gets the plain action; there is no held-key equivalent.
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            submit("jvb");
          }
        }}
        aria-describedby="new-record-hold-hint"
        className={`relative isolate overflow-hidden touch-none select-none disabled:opacity-60 ${
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
        {pending ? "Creating…" : armed ? "New non-JvdB record" : "New record"}
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
    </>
  );
}
