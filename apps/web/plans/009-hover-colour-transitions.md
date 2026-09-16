# 009 — One hover transition for captions and orange links

- **Status**: DONE
- **Commit**: fd8969b
- **Severity**: LOW
- **Category**: Cohesion
- **Estimated scope**: 5 files, one class or one rule each

## Problem

Hover colour changes are instant on tile captions and on orange links, but
transition over 150ms on the nav (`transition-colors` in `site-header.tsx:55`).
Same action, two feels.

```tsx
/* apps/web/src/components/event-tile.tsx:24 — current */
<h3 className="mt-3 font-sans text-ui font-medium leading-snug text-ink group-hover:text-accent">
```

Same pattern in `publication-tile.tsx:23`, `artists-grid.tsx:73`,
`works-foldout.tsx:165`.

```css
/* apps/web/src/app/globals.css:323 — current */
.link-accent:hover {
  color: var(--accent-deep);
}
```

## Target

- Captions: add `transition-colors duration-150` to each of the four caption elements.
- `.link-accent`: add `transition: color 160ms ease;` to the base rule (`globals.css:~314`, the block that sets `color: var(--accent)`), not to the `:hover` rule.

Hover/colour changes use the built-in `ease` (AUDIT.md: hover → `ease`).

## Steps

1. Add `transition-colors duration-150` to the `className` in the four caption lines listed above.
2. In `globals.css`, inside `.link-accent { … }`, add `transition: color 160ms ease;`.

## Boundaries

- Do NOT add motion to images or to the tiles' selection rule (already animated).
- Do NOT touch the nav.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`.
- **Feel check**: hover across the home grid, a caption, "Enquire ↓" and a nav item in turn: every colour change eases at the same speed; none snaps.
- **Done when**: the four captions and `.link-accent` transition colour; nav unchanged.
