"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SaveStatus, SaveStatusProvider, useSaveReporter, useSaveStatus } from "@/components/ui/save-status";
import { Button } from "@/components/ui/button";
import { EditSectionRail } from "@/components/edit-section-rail";

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
 * The line and the section rail sit outside the main <form> on purpose: a
 * sticky element stops at the end of its parent, and the rail has to stay put
 * over the shipment, consignment and documents panels below the form too.
 */

type Flush = () => Promise<boolean>;
type Registry = { register: (id: string, flush: Flush) => () => void };
const EditorSaveContext = createContext<Registry | null>(null);

/** True inside an EditorSaveRoot: the form leaves its own status line to the root. */
export function useInEditorRoot(): boolean {
  return useContext(EditorSaveContext) !== null;
}

/**
 * Give Done a way to save this part now. `flush` resolves true once the
 * server holds what the part shows. A no-op outside an EditorSaveRoot.
 */
export function useFlushForDone(id: string, flush: Flush) {
  const ctx = useContext(EditorSaveContext);
  const latest = useRef(flush);
  useEffect(() => {
    latest.current = flush;
  }, [flush]);
  useEffect(() => ctx?.register(id, () => latest.current()), [ctx, id]);
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
  const registry = useMemo(() => ({ register }), [register]);
  const flushAll = useCallback(async () => {
    const results = await Promise.all(
      [...flushes.current.values()].map((f) => f().catch(() => false)),
    );
    return results.every(Boolean);
  }, []);

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
  // part whose save was already under way, holds Done until it lands.
  useEffect(() => {
    if (phase !== "waiting" || status.state === "saving") return;
    if (status.state === "error") setPhase("idle");
    else router.push(doneHref);
  }, [phase, status.state, doneHref, router]);

  // On small screens the sticky line and rail eat scarce height, so they
  // slide away while scrolling down and come back on the way up.
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
