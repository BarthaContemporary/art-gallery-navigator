# 008 — Consent drawer on the site's drawer curve

- **Status**: DONE
- **Commit**: fd8969b
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, 3 lines

## Problem

The cookie consent drawer slides up over 700ms on a hand-typed curve. Every
other drawer on the site opens in 280–520ms on `--ease-drawer`. 700ms is also
past the 500ms ceiling for a drawer.

```css
/* apps/web/src/app/globals.css:591 — current */
.jvb-consent {
  opacity: 0;
  transform: translateY(100%);
  transition:
    opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}
```

## Target

```css
/* target */
.jvb-consent {
  opacity: 0;
  transform: translateY(100%);
  transition:
    opacity 320ms var(--ease-out),
    transform 480ms var(--ease-drawer);
}
```

`--ease-out` = `cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-drawer` =
`cubic-bezier(0.32, 0.72, 0, 1)`, both already on `:root`.

## Steps

1. Replace the two transition lines as above. Nothing else in the block changes.

## Boundaries

- Do NOT touch `.jvb-consent-btn` or the drawer's markup in `apps/web/src/components/consent-drawer.tsx`.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec next build`.
- **Feel check**: clear site data, reload: the drawer rises and settles in under half a second, with the opacity arriving a touch before the movement finishes. Reduced motion: it appears without sliding (the global reset handles this).
- **Done when**: the drawer's transition uses the two tokens and no inline bezier.
