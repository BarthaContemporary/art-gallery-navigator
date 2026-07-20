"use client";

import { useRef, useState, type ReactNode } from "react";
import { IconTrash } from "@/components/icons";

/**
 * Swipe a row right-to-left to reveal Delete, then confirm. Vertical scrolling
 * still works (touch-action: pan-y), and drags that start on a form control are
 * ignored so inputs/buttons inside the row stay usable.
 */
export function SwipeToDelete({
  onDelete,
  confirmText = "Delete this? This can’t be undone.",
  children,
}: {
  onDelete: () => Promise<void> | void;
  confirmText?: string;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startX = useRef(0);
  const base = useRef(0);
  const active = useRef(false);
  const blocked = useRef(false);
  const moved = useRef(false);

  const OPEN = -84; // resting position that reveals the Delete button
  const CONFIRM_AT = -140; // drag past this → straight to confirm

  function down(e: React.PointerEvent) {
    // Don't hijack drags that begin on a form control (links stay swipeable —
    // an accidental navigation after a real swipe is cancelled in onClickCapture).
    blocked.current = Boolean(
      (e.target as HTMLElement).closest("input,textarea,select,button,[data-noswipe]"),
    );
    moved.current = false;
    if (blocked.current) return;
    active.current = true;
    startX.current = e.clientX;
    base.current = dx;
    setDragging(true);
  }
  function move(e: React.PointerEvent) {
    if (!active.current || blocked.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 8) moved.current = true;
    let next = base.current + delta;
    if (next > 0) next = 0;
    if (next < -200) next = -200;
    setDx(next);
  }
  function up() {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    if (dx <= CONFIRM_AT) {
      setDx(0);
      setConfirming(true);
    } else if (dx <= -42) {
      setDx(OPEN);
    } else {
      setDx(0);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete zone revealed behind the row */}
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-red-600">
        <button
          onClick={() => {
            setDx(0);
            setConfirming(true);
          }}
          className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-white"
        >
          <IconTrash className="h-5 w-5" />
          Delete
        </button>
      </div>

      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          // A swipe shouldn't also trigger a tap (e.g. following a row's link).
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform .2s ease",
          touchAction: "pan-y",
        }}
        className="relative"
      >
        {children}
      </div>

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl border border-line bg-page p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[14px] text-ink-body">{confirmText}</p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="tap flex-1 rounded-xl border border-line-control bg-control font-medium text-ink-body disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="tap flex-1 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
