# 011 — Active slideshow marker fills across the interval

- **Status**: DONE
- **Commit**: cbe7ccf
- **Severity**: LOW (additive)
- **Category**: Missed opportunity
- **Estimated scope**: 2 files (`hero-slideshow.tsx`, `globals.css`)

## Problem
The active marker bar is static for the whole 6.5s interval; nothing tells the visitor the slideshow is alive or when it will move.

## Target
The active bar keeps its grey track and an orange fill grows from the left over `INTERVAL_MS` with `linear` easing (constant motion), restarting on every slide change (React `key` on the fill). Hover/focus pauses the autoplay and the fill together (`animation-play-state: paused`). With fewer than two slides or reduced motion there is no fill; the bar is simply orange.

```css
.marker-fill { transform-origin: left center; animation: marker-fill var(--slide-ms) linear both; }
.marker-fill[data-paused="true"] { animation-play-state: paused; }
@keyframes marker-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
```

## Verification
Home: the orange fill reaches the end of the bar exactly as the next slide fades in; hovering freezes it; moving off resumes. Reduced motion: solid orange bar, no autoplay.
