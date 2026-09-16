# 005 — Lighter backdrop blur on the two full-screen layers

- **Status**: DONE
- **Commit**: fd8969b
- **Severity**: MEDIUM
- **Category**: Performance
- **Estimated scope**: 2 files, 2 class names

## Problem

The image zoom and the reader's full-screen view sit on a translucent layer
with a 40px backdrop blur over a page full of photographs, and that layer
fades in. Backdrop blur is the most expensive paint on the site; at 40px it
stutters on Safari and iPads during the fade.

```tsx
/* apps/web/src/components/lightbox.tsx:176 — current */
className={`lightbox fixed inset-0 z-[60] bg-white/55 backdrop-blur-2xl ${closing ? "lightbox-closing" : ""}`}
```

```tsx
/* apps/web/src/components/page-flip-reader.tsx:~104 — current */
? "lightbox fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white/55 p-6 backdrop-blur-2xl md:p-10"
```

## Target

Both use `backdrop-blur-xl` (24px). The frosted look stays; the paint cost
roughly halves. Nothing else changes.

## Repo conventions to follow

- Tailwind v4 utilities; `backdrop-blur-xl` is the 24px step.
- The `.lightbox` open/close keyframes in `apps/web/src/app/globals.css` stay as they are.

## Steps

1. In `apps/web/src/components/lightbox.tsx`, replace `backdrop-blur-2xl` with `backdrop-blur-xl` on the outer layer.
2. In `apps/web/src/components/page-flip-reader.tsx`, do the same in the fullscreen class string.

## Boundaries

- Do NOT change the layer's colour or opacity (`bg-white/55`).
- Do NOT touch zoom, drag or key handling.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`.
- **Feel check**: open a work's image full screen on an iPad or in Safari, and the reader's Fullscreen. The fade-in is smooth with no dropped frames; the page behind is still clearly frosted, not merely dimmed. In Chrome DevTools → Performance, record the open: no frame over 32ms.
- **Done when**: both layers report `backdrop-filter: blur(24px)` in computed styles.
