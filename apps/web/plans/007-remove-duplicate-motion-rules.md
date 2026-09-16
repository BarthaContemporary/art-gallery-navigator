# 007 — Remove the duplicated motion rules in globals.css

- **Status**: TODO
- **Commit**: fd8969b
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, delete ~40 lines

## Problem

`apps/web/src/app/globals.css` declares the `.panel-swap` rule, its
`@keyframes panel-swap`, the `.lightbox`, `.lightbox-img`, `.lightbox-closing`
rules and the `lightbox-in`, `lightbox-out`, `lightbox-img` keyframes twice,
identically. The first copy runs from the comment
`/* Content swap inside an already-open panel …` at line 466 through the end
of `@keyframes lightbox-img` at ~line 512; the second copy starts at the same
comment again at line 523 and ends at ~line 569. Between them sits the
`.panel-text` block (line 513–522), which must stay.

## Target

One copy of each rule. Keep the **second** copy's position is not important;
keep the **first** copy and delete the second, so the `.panel-text` rules are
followed directly by the reduced-motion block that ends the layer.

## Repo conventions to follow

- Everything lives under `@layer components` in `globals.css`; do not move rules out of the layer.

## Steps

1. Open `apps/web/src/app/globals.css`.
2. Locate the second occurrence of the comment line `/* Content swap inside an already-open panel: slides in from the side of` (around line 523).
3. Delete from that comment through the closing brace of the second `@keyframes lightbox-img` block (around line 569), stopping before `@media (prefers-reduced-motion: reduce) {` that follows.
4. Confirm with `grep -c "@keyframes panel-swap" src/app/globals.css` → `1`, and the same for `lightbox-in`, `lightbox-out`, `lightbox-img`.

## Boundaries

- Do NOT edit the first copy or the `.panel-text` block.
- Do NOT reformat other parts of the file.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec next build` (a stray brace fails the build with "Unclosed block").
- **Feel check**: open a work panel, click another tile in the same row: the content still slides in from the clicked side. Open an image full screen: it still fades in and out.
- **Done when**: each keyframe name appears once and the build passes.
