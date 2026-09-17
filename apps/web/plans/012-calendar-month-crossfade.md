# 012 — Directional crossfade when the booking calendar changes month

- **Status**: DONE
- **Commit**: cbe7ccf
- **Severity**: LOW (additive)
- **Category**: Missed opportunity
- **Estimated scope**: 1 file (`appointment-form.tsx`); reuses `.panel-swap`

## Problem
The month grid in `Calendar` swaps in one frame when the arrows are used.

## Target
The day grid is keyed by month and re-enters with the existing `panel-swap` animation (260ms, `--ease-out`, opacity + translateX from `--swap-x`): +12px when moving to a later month, −12px when moving back. The month label does not move.

## Verification
About → Book an appointment → "→": the days slide in from the right and fade; "←" from the left. Reduced motion: fade only (the existing reduced-motion rule maps `panel-swap` to a plain fade).
