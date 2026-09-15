# 002 — Move the panel between tiles without collapsing and reopening

- **Status**: TODO
- **Commit**: 68e18eb
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 1 file (works-foldout.tsx), ~40 lines

## Problem

Clicking a second tile while a panel is open is the most common interaction on
an event page (the handoff: "clicking another tile moves the panel"). Today the
panel `<li>` is keyed by the work id, so React unmounts the open panel and
mounts a fresh one at `0fr`: the open panel vanishes in one frame, the rows
below jump up, then a new panel animates open from nothing. In the same row
this reads as a flicker; across rows it is a double layout jump.

```tsx
/* apps/web/src/components/works-foldout.tsx:149 — current */
i === panelAfter && panelWork ? (
  <li key={`panel-${panelWork.id}`} className="col-span-full">
    <div
      className="fold"
      data-open={selected === panelWork.id}
      onTransitionEnd={() => {
        if (selected === null) setRendered(null);
      }}
    >
      <div id={`work-panel-${panelWork.id}`} aria-hidden={selected !== panelWork.id}>
        <div ref={panelRef} className="pt-4 pb-6">
          <WorkPanel … />
```

`panelAfter` (line ~101) is the index of the last tile in the selected tile's
row; the panel `<li>` is emitted after that tile.

## Target

- Key the panel `<li>` by **row**, not by work: `key={`panel-row-${Math.floor(renderedIndex / cols)}`}`. Moving within a row then keeps the same `.fold` element open, and only the content changes.
- Crossfade the content when `panelWork.id` changes within a row: wrap `<WorkPanel>` in a keyed element that fades in on mount.

```tsx
/* target — panel li */
<li key={`panel-row-${Math.floor(renderedIndex / cols)}`} className="col-span-full">
  <div className="fold" data-open={selected !== null && selected === panelWork.id} onTransitionEnd={…unchanged…}>
    <div id={`work-panel-${panelWork.id}`} aria-hidden={selected !== panelWork.id}>
      <div ref={panelRef} className="fold-body pt-4 pb-6">
        <div key={panelWork.id} className="panel-swap">
          <WorkPanel … />
        </div>
      </div>
    </div>
  </div>
</li>
```

```css
/* apps/web/src/app/globals.css — after the .fold-body rules */
.panel-swap {
  animation: panel-swap 180ms var(--ease-out);
}
@keyframes panel-swap {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

Moving to a tile in a **different** row still unmounts (the panel must sit
under the new row); that is correct and inherent. To soften it, close first
and open second: when the new tile's row differs from the rendered row, set
`selected` to null, wait for the fold's `transitionend`, then select the new
id. The fold's `onTransitionEnd` already exists; extend it with a
`pendingRef` (a `useRef<string | null>`) that holds the next id.

## Repo conventions to follow

- `useCallback`/`useRef` hooks as in the existing `select` (line ~70) and `tileRefs` (line ~57).
- `--ease-out` token from plan 001 (`cubic-bezier(0.23, 1, 0.32, 1)`); if plan 001 has not run, add the token to `:root` in `globals.css` first, exactly as written there.
- Keyframes are fine here: the swap is a one-shot entrance, never reversed mid-flight.

## Steps

1. Read `apps/web/src/components/works-foldout.tsx` top to bottom once.
2. Add `const pendingRef = useRef<string | null>(null);` next to `tileRefs`.
3. Change `select` so that, when `id` is non-null, `rendered` is non-null, and `Math.floor(indexOf(id) / cols) !== Math.floor(indexOf(rendered) / cols)`, it stores `id` in `pendingRef.current`, calls `setSelected(null)`, and returns (do not call `writeParam` yet). Otherwise keep the current behaviour.
4. In the fold's `onTransitionEnd`, when `selected === null`: if `pendingRef.current` is set, take it into a local `next`, clear the ref, then `setSelected(next); setRendered(next); writeParam(next); setEnquiryOpen(false)`; else `setRendered(null)` as today. Guard with `e.target === e.currentTarget` so child transitions (hover colours) do not trigger it.
5. Change the panel `<li>` key to `panel-row-${Math.floor(renderedIndex / cols)}`.
6. Wrap `<WorkPanel …/>` in `<div key={panelWork.id} className="panel-swap">`.
7. Add the `.panel-swap` rule and `@keyframes panel-swap` to `globals.css` under `@layer components`, after the `.fold-body` rules.

## Boundaries

- Do NOT change the tile markup, `useColumns`, or the URL sync (`writeParam`) semantics beyond deferring it in step 3.
- Do NOT touch `EnquiryForm`, `read-more.tsx`, or `inline-enquiry.tsx`.
- No new dependencies.
- If `panelAfter` or the panel `<li>` do not match the excerpt, STOP and report.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`; `pnpm exec next build`.
- **Feel check** on `/events/perfect-presence` at 1440px (4 columns):
  - Open tile 1, then click tile 3 (same row): the panel stays open at full height; only the content crossfades (~180ms). No collapse, no jump.
  - Open tile 1, then click tile 6 (next row): the first panel folds closed, then the second folds open under row 2. One motion, no frame where both are gone at once.
  - Click the open tile again: it folds closed and focus returns to the tile.
  - Spam-click between two tiles in one row: nothing restarts from zero; the last click wins.
  - `?work=` in the URL always ends on the last selected id.
- **Done when**: same-row moves never change panel height; cross-row moves are a close-then-open sequence.
