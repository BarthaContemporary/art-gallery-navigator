# 003 — Keep the enquiry form mounted while its fold closes

- **Status**: TODO
- **Commit**: 68e18eb
- **Severity**: MEDIUM
- **Category**: Interruptibility
- **Estimated scope**: 2 files (works-foldout.tsx, inline-enquiry.tsx), ~20 lines

## Problem

The inline enquiry (work panel "Enquire ↓", publication "Enquire to order ↓",
About "Request an appointment ↓") is a `.fold` whose child is rendered only
while open. On collapse the form unmounts in the same render that flips
`data-open` to false, so the fold animates the height of an already-empty box:
the form vanishes in one frame and the layout below jumps up ~300px instantly.

```tsx
/* apps/web/src/components/works-foldout.tsx:268 — current */
<div className="fold" data-open={enquiryOpen}>
  <div aria-hidden={!enquiryOpen}>
    <div className="max-w-[640px] pb-2">
      {enquiryOpen ? (
        <EnquiryForm … onCollapse={() => onEnquiry(false)} />
      ) : null}
```

```tsx
/* apps/web/src/components/inline-enquiry.tsx:28 — current */
<div className="fold" data-open={open}>
  <div aria-hidden={!open}>
    <div className="pb-2">
      {open ? ( <EnquiryForm … onCollapse={() => setOpen(false)} /> ) : null}
```

The pattern already used for the work panel itself is the fix: a second
"rendered" flag that stays true until the fold's `transitionend`.

## Target

```tsx
/* pattern — apply in both files */
const [open, setOpen] = useState(false);
const [mounted, setMounted] = useState(false); // stays true while folding closed
const show = () => { setMounted(true); setOpen(true); };
const hide = () => setOpen(false);

<div
  className="fold"
  data-open={open}
  onTransitionEnd={(e) => {
    if (e.target === e.currentTarget && !open) setMounted(false);
  }}
>
  <div aria-hidden={!open}>
    <div className="fold-body pb-2">
      {mounted ? <EnquiryForm … onCollapse={hide} /> : null}
    </div>
  </div>
</div>
{!open ? <button … onClick={show}>…</button> : null}
```

In `works-foldout.tsx` the open flag is a prop (`enquiryOpen`, `onEnquiry`);
keep the prop and add a local `mounted` state inside `WorkPanel` that is set
true whenever `enquiryOpen` becomes true (a `useEffect` on `enquiryOpen`).

## Repo conventions to follow

- The exemplar is `rendered` / `setRendered` in `works-foldout.tsx:53-54` with the `onTransitionEnd` at line ~153.
- Hooks: `useState`, `useEffect` from React as already imported in these files.

## Steps

1. `inline-enquiry.tsx`: add `mounted` state; `show()` sets both; the button calls `show`; `EnquiryForm` renders when `mounted`; add the `onTransitionEnd` handler that clears `mounted` once closed.
2. `works-foldout.tsx` `WorkPanel`: add `const [mounted, setMounted] = useState(enquiryOpen);` and `useEffect(() => { if (enquiryOpen) setMounted(true); }, [enquiryOpen]);`; render the form when `mounted`; add the same `onTransitionEnd` on that `.fold` (`if (e.target === e.currentTarget && !enquiryOpen) setMounted(false)`).
3. Because the work panel's own fold wraps this one, keep the `e.target === e.currentTarget` guard so the outer fold's handler ignores the inner transition and vice versa.

## Boundaries

- Do NOT change `EnquiryForm` itself or its submit logic.
- Do NOT touch `read-more.tsx` (its content is always mounted; it already folds correctly).
- No new dependencies.

## Verification

- **Mechanical**: `cd apps/web && pnpm exec tsc --noEmit`; `pnpm exec next build`.
- **Feel check**:
  - Work panel: click "Enquire ↓", then "↑": the form folds closed over ~350ms with its fields still visible while shrinking; the "Enquire ↓" link reappears only after.
  - `/about` → "Request an appointment ↓" → "↑": same.
  - Send a successful enquiry, then collapse: the one-line confirmation folds away, not the form.
  - DevTools Animations at 10%: the closing fold shows the form contents inside the shrinking box.
- **Done when**: no fold on the site ever animates an empty box.
