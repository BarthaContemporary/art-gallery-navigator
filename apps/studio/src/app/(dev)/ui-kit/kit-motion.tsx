"use client";

/*
 * The /ui-kit page's motion primitives, live: the expanding search, the
 * folding region and a button that goes pending on a click. Dev only, like
 * the page; no <form> and no named fields, so the form-key guard does not
 * see them.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapse, Disclosure } from "@/components/ui/collapse";
import { ExpandingSearch } from "@/components/ui/expanding-search";
import { CheckIcon, RefreshIcon } from "@/components/ui/icons";

function Specimen({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className ? `min-w-0 ${className}` : "min-w-0"}>
      <p className="mb-1.5 text-[11px] leading-[1.3] text-meta">{label}</p>
      {children}
    </div>
  );
}

/** Folded, hovered, open with a value, focused, small, and one live with "/". */
export function ExpandingSearchStates() {
  const [q, setQ] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <Specimen label="Folded">
        <ExpandingSearch label="Search inventory" />
      </Specimen>
      <Specimen label="Folded, hover">
        <ExpandingSearch label="Search inventory" data-preview="hover" />
      </Specimen>
      <Specimen label="Open with a value (stays open)">
        <ExpandingSearch label="Search inventory" defaultValue="Hamada" width="14rem" />
      </Specimen>
      <Specimen label="Open, empty (defaultOpen)">
        <ExpandingSearch label="Search inventory" defaultOpen placeholder="Stock no., title, maker" width="16rem" />
      </Specimen>
      <Specimen label="Open, focus">
        <ExpandingSearch label="Search inventory" defaultValue="Kyoto" width="12rem" data-preview="focus" />
      </Specimen>
      <Specimen label="Small, open">
        <ExpandingSearch label="Search lists" size="sm" defaultValue="Autumn" width="12rem" />
      </Specimen>
      <Specimen label='Live: click, or press "/" (Escape folds it when empty)' className="min-w-[18rem]">
        <ExpandingSearch
          label="Search the kit"
          shortcut
          value={q}
          onValueChange={setQ}
          placeholder="Type, then Escape"
          width="18rem"
        />
        <p className="mt-1.5 text-[12px] text-meta" aria-live="polite">
          {q ? `Value: ${q}` : "Empty"}
        </p>
      </Specimen>
    </div>
  );
}

/** Disclosure closed and open, and a Collapse under a trigger of its own. */
export function CollapseStates() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Specimen label="Disclosure, closed">
        <Disclosure summary="Purchase details">
          <p className="pb-1 pt-2 text-[13px] text-body">Bought at auction, London, 12 March 2024.</p>
        </Disclosure>
      </Specimen>
      <Specimen label="Disclosure, open">
        <Disclosure summary="Purchase details" defaultOpen>
          <p className="pb-1 pt-2 text-[13px] text-body">
            Bought at auction, London, 12 March 2024. The fold eases over 260ms; reduced motion makes it instant.
          </p>
        </Disclosure>
      </Specimen>
      <Specimen label="Collapse with its own trigger (secondary)">
        <Button size="sm" aria-expanded={open} aria-controls="kit-collapse" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide filters" : "More filters"}
        </Button>
        <Collapse id="kit-collapse" open={open}>
          <div className="mt-2 border border-rule p-3 text-[13px] text-body">
            Location, list and website filters live here.
            <div className="mt-2">
              <Button size="sm" variant="quiet">
                Clear filters
              </Button>
            </div>
          </div>
        </Collapse>
      </Specimen>
    </div>
  );
}

/** A primary and a secondary that go pending for two seconds on a click. */
export function PendingLive() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (key: string) => {
    setBusy(key);
    setTimeout(() => setBusy(null), 2000);
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" pending={busy === "p"} pendingLabel="Saving…" onClick={() => run("p")}>
        Save details
      </Button>
      <Button icon={<RefreshIcon size={14} />} pending={busy === "s"} pendingLabel="Syncing…" onClick={() => run("s")}>
        Sync now
      </Button>
      <Button iconOnly label="Confirm" pending={busy === "i"} onClick={() => run("i")}>
        <CheckIcon />
      </Button>
    </div>
  );
}
