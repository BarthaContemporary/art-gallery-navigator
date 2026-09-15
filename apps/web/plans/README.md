# Animation plans — works fold-out

Audit of the fold-out panel (`apps/web/src/components/works-foldout.tsx`, `.fold` in `globals.css`) at commit 68e18eb. Each plan is self-contained; run them with any agent.

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Strong ease-out token for the fold, content reveal, tile rule transition | HIGH | TODO |
| 002 | Move the panel between tiles without collapsing and reopening | HIGH | TODO |
| 003 | Keep the enquiry form mounted while its fold closes | MEDIUM | TODO |

## Order

1. **001** first — it introduces `--ease-out` and the `fold-body` class the other two rely on.
2. **002** next (uses `--ease-out` and `fold-body`).
3. **003** last (independent of 002, but touches the same file; run after to avoid merge friction).

## Accepted as-is

- `grid-template-rows` is a layout animation. It cannot be transform-only because the rows beneath must push down (handoff 2b2); this is the intended trade.
- 350ms duration is a handoff decision and is not changed.
- The global reduced-motion reset (`globals.css:151`) already disables the height animation; plans keep opacity feedback.
