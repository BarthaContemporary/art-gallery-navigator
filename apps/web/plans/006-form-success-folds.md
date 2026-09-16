# 006 — Fold from form to thank-you line instead of snapping

- **Status**: DONE
- **Commit**: fd8969b
- **Severity**: MEDIUM
- **Category**: Physicality
- **Estimated scope**: 3 files (`enquiry-form.tsx`, `newsletter-form.tsx`, `appointment-form.tsx`), ~30 lines

## Problem

When a form is sent successfully the whole form is replaced by one line in a
single frame. Inside an open drawer that means the box collapses from about
400px to 30px with no motion; in the footer the newsletter block jumps.

```tsx
/* apps/web/src/components/enquiry-form.tsx:83 — current */
if (status === "done") {
  return (
    <p className="font-sans text-ui text-ink" role="status">
      Thank you — your message has been sent. We&rsquo;ll reply by email.
    </p>
  );
}
```

`newsletter-form.tsx:40` and `appointment-form.tsx:172` have the same shape.

## Target

Render both states and let the existing `.fold` mechanism move between them:
the form folds closed (280ms, `--ease-out`) while the thank-you line folds
open (520ms, `--ease-drawer`) — the same two curves every drawer on the site
already uses. Only the height and opacity animate; markup stays.

```tsx
/* target — pattern for all three forms; `done` is `status === "done"` */
<div className="fold" data-open={!done} aria-hidden={done}>
  <div>
    <div className="fold-body">
      <form …>…</form>
    </div>
  </div>
</div>
<div className="fold" data-open={done} aria-hidden={!done}>
  <div>
    <div className="fold-body">
      <p className="font-sans text-ui text-ink" role="status">Thank you — …</p>
    </div>
  </div>
</div>
```

`.fold`, `.fold[data-open="true"]`, `.fold > *` and `.fold-body` are defined
in `apps/web/src/app/globals.css` (search for `.fold {`) and need no change.
The form must stay mounted while it folds closed, so do not return early.

## Repo conventions to follow

- The drawer pattern: `apps/web/src/components/inline-enquiry.tsx` (a `.fold` wrapping a `.fold-body`).
- Keep `role="status"` on the thank-you line so screen readers announce it.
- Inputs inside the closed fold must not be tabbable: add `inert` to the form's fold wrapper when `done` (`{...(done ? { inert: true } : {})}`).

## Steps

1. `enquiry-form.tsx`: remove the early `return` for `done`; wrap the existing `<form>` in the first `.fold` above and the thank-you `<p>` in the second. Keep `gridCols` and everything inside the form untouched.
2. `newsletter-form.tsx`: same. The thank-you text keeps `mt-4 font-sans text-ui` and white colour on the orange.
3. `appointment-form.tsx`: the success branch already lives inside the outer drawer's `fold-body`; replace the ternary with the two-fold pattern inside that body so the calendar folds away and the confirmation folds in.
4. Nothing in the API routes changes.

## Boundaries

- Do NOT change validation, payloads or the consent checkbox.
- Do NOT add new CSS; the fold rules already exist.
- If a form's `done` block does not match the excerpt, STOP and report.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`; `pnpm exec next build`.
- **Feel check**: submit an enquiry from a work panel (a test address is fine, the gallery receives it): the fields fold up over about a quarter second while the thank-you line settles in beneath; the drawer never jumps. Repeat on the About booking and the footer newsletter.
  - DevTools → Animations at 10%: two `grid-template-rows` transitions run, one closing, one opening.
  - Tab after success: focus does not land in the hidden form.
- **Done when**: no success state changes height in a single frame.
