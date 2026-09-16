# 004 — Faster, interruptible page turns in the publication reader

- **Status**: TODO
- **Commit**: fd8969b
- **Severity**: MEDIUM
- **Category**: Easing & duration / Interruptibility
- **Estimated scope**: 1 file (`apps/web/src/components/page-flip-reader.tsx`), ~15 lines

## Problem

Arrow keys turn pages from anywhere on a publication page, so paging through a
24-spread catalogue is a rapid, repeated keyboard action. Each press starts a
650ms keyframe pair and the staying half fades with `ease-in`, which delays
the moment the reader is watching. A press during a turn restarts the whole
animation from zero.

```ts
/* apps/web/src/components/page-flip-reader.tsx:6 — current */
const FLIP_MS = 650;
```

```tsx
/* apps/web/src/components/page-flip-reader.tsx:143 — current */
style={{ [turn.dir === 1 ? "left" : "right"]: 0, width: "50%", animation: `reader-fade ${FLIP_MS}ms ease-in forwards` }}
```

```tsx
/* apps/web/src/components/page-flip-reader.tsx:156 — current */
animation: `${turn.dir === 1 ? "reader-turn-fwd" : "reader-turn-back"} ${FLIP_MS}ms ease-in-out forwards`,
```

```ts
/* apps/web/src/components/page-flip-reader.tsx:23 — current */
const go = useCallback(
  (dir: 1 | -1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= count) return i;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) setTurn({ from: i, dir });
      return next;
    });
```

## Target

- `FLIP_MS = 420`.
- The staying half fades with the site's strong ease-out token: `reader-fade ${FLIP_MS}ms var(--ease-out) forwards`. (`--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`, defined on `:root` in `apps/web/src/app/globals.css`.)
- The turning half keeps `ease-in-out` (on-screen movement).
- Only one turn in flight: if a press arrives while `turn` is set, the index still moves but no new turn is started, so the current animation finishes and the new spread is simply there. No restart from zero.

```ts
/* target — go() */
const go = useCallback(
  (dir: 1 | -1) => {
    setIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= count) return i;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // One turn at a time: a press mid-turn jumps, it does not restart.
      if (!reduce && !turnRef.current) setTurn({ from: i, dir });
      return next;
    });
  },
  [count],
);
```

with `const turnRef = useRef<typeof turn>(null);` kept in sync by an effect (`useEffect(() => { turnRef.current = turn; }, [turn]);`) so `go` does not need `turn` in its dependency list.

## Repo conventions to follow

- Easing tokens live on `:root` in `apps/web/src/app/globals.css` (`--ease-out`, `--ease-drawer`, `--ease-in-out`). Use them by name; never paste a bezier inline.
- Hooks pattern: see `pinch`/`drag` refs in `apps/web/src/components/lightbox.tsx` for refs mirroring state.
- Keyframes `reader-turn-fwd`, `reader-turn-back`, `reader-fade` stay where they are (`globals.css`, bottom of file).

## Steps

1. Change `const FLIP_MS = 650;` to `const FLIP_MS = 420;`.
2. In the staying-half `style`, replace `ease-in` with `var(--ease-out)`.
3. Add `const turnRef = useRef<{ from: number; dir: 1 | -1 } | null>(null);` next to the other refs, and `useEffect(() => { turnRef.current = turn; }, [turn]);` after the existing `turn` timeout effect.
4. In `go`, change `if (!reduce) setTurn({ from: i, dir });` to `if (!reduce && !turnRef.current) setTurn({ from: i, dir });`.

## Boundaries

- Do NOT change the swipe thresholds, the fullscreen layer, or the keyboard listener.
- Do NOT touch the keyframes in `globals.css`.
- No new dependencies.
- If the excerpts above do not match the file, STOP and report.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`; `pnpm exec next build`.
- **Feel check** on `/publications/perfect-presence`:
  - Press → once: the page turns in well under half a second and the far half never lingers.
  - Hold → down (key repeat): the counter climbs steadily; the animation does not stutter or restart, and the spread shown always matches the counter when you let go.
  - DevTools → Animations at 10%: the staying half fades out fast at first, then eases; nothing starts slow.
  - Rendering panel → reduced motion: spreads swap with no turn.
- **Done when**: 420ms turns, ease-out fade, key repeat never restarts a turn.
