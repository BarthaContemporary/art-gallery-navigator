# 001 — Strong ease-out token for the fold, content reveal, tile rule transition

- **Status**: DONE (commit follows 653c6ff)
- **Commit**: 68e18eb
- **Severity**: HIGH
- **Category**: Easing & duration (+ Physicality, Cohesion)
- **Estimated scope**: 2 files (globals.css, works-foldout.tsx), ~25 lines

## Problem

The works fold-out (event and artist pages) animates its height with the
browser's built-in `ease-out`, which is a weak curve: the panel spends most of
its 350ms visibly creeping. The content inside appears as a bare clip with no
opacity ramp, so the panel reads as a curtain lifting rather than a card
settling. The selected tile's 2px orange rule pops in with no transition.

```css
/* apps/web/src/app/globals.css:338 — current */
.fold {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--fold-ms) ease-out;
}
.fold[data-open="true"] {
  grid-template-rows: 1fr;
}
.fold > * {
  overflow: hidden;
  min-height: 0;
}
```

```tsx
/* apps/web/src/components/works-foldout.tsx:131 — current */
className={`work-tile group block w-full border-t-2 text-left ${isSelected ? "border-t-accent" : "border-t-transparent"}`}
```

The 350ms duration is a decision from the design handoff ("height animates
open ~350ms, ease-out") — keep it. Only the curve and the reveal change.

## Target

```css
/* apps/web/src/app/globals.css — :root, next to --fold-ms */
--fold-ms: 350ms;
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);      /* strong ease-out for UI */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement */

/* apps/web/src/app/globals.css — replaces the .fold block */
.fold {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--fold-ms) var(--ease-out);
}
.fold[data-open="true"] {
  grid-template-rows: 1fr;
}
.fold > * {
  overflow: hidden;
  min-height: 0;
}
/* the panel's content settles in after the height starts moving */
.fold-body {
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 200ms var(--ease-out),
    transform 200ms var(--ease-out);
}
.fold[data-open="true"] .fold-body {
  opacity: 1;
  transform: none;
  transition-delay: 80ms;
}
@media (prefers-reduced-motion: reduce) {
  .fold-body {
    transform: none; /* opacity feedback stays, movement goes */
  }
}

/* the selected tile's rule fades in rather than popping */
.work-tile {
  transition: border-top-color 160ms ease;
}
```

```tsx
/* apps/web/src/components/works-foldout.tsx — the panel's inner wrapper */
<div ref={panelRef} className="fold-body pt-4 pb-6">
```

## Repo conventions to follow

- Design tokens live on `:root` in `apps/web/src/app/globals.css` (see `--fold-ms: 350ms;` at line 40). Add the easing tokens there, not in Tailwind `@theme`.
- Component-level utilities live under `@layer components` in the same file; `.fold` at line 338 is the exemplar.
- The global reduced-motion reset at `globals.css:151` already shortens every transition to 0.01ms; the `.fold-body` reduced-motion block only removes the translate so the reset does not leave a 6px offset behind.
- `.slide` at `globals.css:352` is the other crossfade in the file; do not touch it.

## Steps

1. In `apps/web/src/app/globals.css`, inside `:root`, directly after `--fold-ms: 350ms;`, add:
   `--ease-out: cubic-bezier(0.23, 1, 0.32, 1);` and
   `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);`
2. In the same file, change `.fold`'s transition line to
   `transition: grid-template-rows var(--fold-ms) var(--ease-out);`
3. Directly after the `.fold > * { … }` rule, add the `.fold-body`, `.fold[data-open="true"] .fold-body`, and reduced-motion rules exactly as in Target.
4. Inside the existing `.work-tile:focus-visible` block's neighbourhood (line ~332), add a `.work-tile { transition: border-top-color 160ms ease; }` rule.
5. In `apps/web/src/components/works-foldout.tsx`, find `<div ref={panelRef} className="pt-4 pb-6">` (inside the `.fold` li, ~line 157) and add the `fold-body` class: `className="fold-body pt-4 pb-6"`.
6. Do the same for the two other `.fold` users so the site stays cohesive: in `apps/web/src/components/read-more.tsx` the inner `<div className="pt-4">` becomes `className="fold-body pt-4"`; in `apps/web/src/components/inline-enquiry.tsx` the inner `<div className="pb-2">` becomes `className="fold-body pb-2"`; in `works-foldout.tsx` the enquiry wrapper `<div className="max-w-[640px] pb-2">` becomes `className="fold-body max-w-[640px] pb-2"`.

## Boundaries

- Do NOT change `--fold-ms` (handoff decision).
- Do NOT touch `.slide`, the reader keyframes, `.btn`, or the consent drawer.
- Do NOT add dependencies. CSS and one class name per component only.
- If `.fold` or `panelRef` do not match the excerpts above, STOP and report.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit` passes; `pnpm exec next build` completes with 88 static pages.
- **Feel check**: open `/events/perfect-presence`, click a work tile.
  - The panel reaches most of its height in the first ~120ms and settles gently — no creeping tail.
  - The text and image inside fade and rise into place *after* the height starts moving, never before.
  - The orange rule on the tile fades in over a blink, not a pop.
  - In DevTools → Animations, set playback to 10%: `grid-template-rows` and `.fold-body` opacity/transform are the only animating properties.
  - Rendering panel → emulate `prefers-reduced-motion: reduce`: panel snaps open, content still fades, nothing translates.
- **Done when**: the three `.fold` users share `--ease-out`, the feel checks pass on desktop Chrome and iOS Safari.
