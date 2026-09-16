# Animation plans — works fold-out

Audit of the fold-out panel (`apps/web/src/components/works-foldout.tsx`, `.fold` in `globals.css`) at commit 68e18eb. Each plan is self-contained; run them with any agent.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Strong ease-out token for the fold, content reveal, tile rule transition | HIGH | DONE |
| 002 | Move the panel between tiles without collapsing and reopening | HIGH | DONE |
| 003 | Keep the enquiry form mounted while its fold closes | MEDIUM | DONE |
| 004 | Faster, interruptible page turns in the publication reader | MEDIUM | TODO |
| 005 | Lighter backdrop blur on the two full-screen layers | MEDIUM | TODO |
| 006 | Fold from form to thank-you line instead of snapping | MEDIUM | TODO |
| 007 | Remove the duplicated motion rules in globals.css | LOW | TODO |
| 008 | Consent drawer on the site's drawer curve | LOW | TODO |
| 009 | One hover transition for captions and orange links | LOW | TODO |

## Order

Round one (done): 001 → 002 → 003.

Round two, audit at fd8969b:

1. **007** first — it deletes duplicate rules in `globals.css`; doing it before 008 and 009 keeps their line references honest.
2. **004** and **005** next, independent of each other and of the rest.
3. **006** — touches three form components; run after 004/005 so a review sees one concern per diff.
4. **008** and **009** last, cosmetic and independent.

Not planned (recorded as missed opportunities, additive): fade-and-stagger for rows revealed by infinite scroll; a filling active marker on the hero slideshow; a directional crossfade when the booking calendar changes month.

## Accepted as-is

- `grid-template-rows` is a layout animation. It cannot be transform-only because the rows beneath must push down (handoff 2b2); this is the intended trade.
- 350ms duration is a handoff decision and is not changed.
- The global reduced-motion reset (`globals.css:151`) already disables the height animation; plans keep opacity feedback.
