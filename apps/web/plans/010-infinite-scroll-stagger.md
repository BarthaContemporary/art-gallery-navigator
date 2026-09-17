# 010 — Fade and stagger rows revealed by infinite scroll

- **Status**: DONE
- **Commit**: cbe7ccf
- **Severity**: LOW (additive)
- **Category**: Missed opportunity
- **Estimated scope**: 2 files (`infinite-grid.tsx`, `globals.css`)

## Problem
`InfiniteGrid` (`apps/web/src/components/infinite-grid.tsx`) reveals the next page of tiles by raising `visible`; the new `<li>`s appear in one frame.

## Target
Tiles revealed after the first page enter with a 240ms fade and 6px rise on `--ease-out`, staggered 30ms per tile (capped at 12 steps). The first page never animates (no flash on load). Reduced motion: opacity only.

```css
.tile-in { animation: tile-in 240ms var(--ease-out) both; }
@keyframes tile-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
```
Delay is set inline: `style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}` for the i-th newly revealed tile. Decorative only; the tiles are interactive from the first frame.

## Verification
Home page → "Show more": the new row fades up left to right; earlier rows do not move. Reduced motion: fade only.
