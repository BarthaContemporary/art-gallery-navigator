"use client";

/*
 * A search field folded to its icon (spec section 5, motion). It unfolds
 * into a field on a click, a tap or (with `shortcut`) the "/" key, stays
 * open while it holds a value, and folds back when it is emptied and left.
 *
 *   <ExpandingSearch name? label? value? onValueChange? defaultValue?
 *                    placeholder? size? width? shortcut? defaultOpen?
 *                    onOpenChange? className? inputProps?>
 *     name          the input's name: it is a real <input type="search">
 *                   inside whatever <form> surrounds it, so FormData, a GET
 *                   submit and an autosave listener see it as they would a
 *                   bare input. While folded it is empty (it only folds
 *                   when empty), so it submits what an empty field would.
 *     label         the accessible name of the button and the field
 *                   ("Search" by default; "Search inventory" is better).
 *     value + onValueChange   controlled, for a field that drives a URL
 *                   parameter on a debounce. Or defaultValue, uncontrolled.
 *     size          "md" (control height, 32px; 44px on touch) | "sm".
 *     width         the open width, any CSS length (default 18rem). It
 *                   never grows past its container.
 *     shortcut      "/" opens and focuses it while focus is not in a field
 *                   and no dialog is open. It takes the key before the
 *                   command palette's own "/" listener, so use it on at most
 *                   one search per page; ⌘K / Ctrl K still opens the palette.
 *     defaultOpen   starts unfolded even when empty.
 *
 * Keys: Escape in the field folds it if it is empty and returns focus to
 * the button; with a value it keeps the value (Escape never clears a filter
 * by surprise) and returns focus, so j/k-style page keys work again. The
 * clear button (shown while there is a value) empties the field through a
 * native input event, so React's onChange and any form listener both run.
 *
 * Accessibility: the button has aria-expanded and aria-controls naming the
 * field; while folded the field is visibility: hidden (not focusable, not
 * read). The open width eases over 240ms; reduced motion makes it instant.
 * Styles: .xsearch in app/globals.css.
 */
import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { cx } from "./cx";
import { CloseIcon, SearchIcon } from "./icons";

type InputExtras = Omit<
  ComponentPropsWithoutRef<"input">,
  "name" | "value" | "defaultValue" | "onChange" | "type" | "id" | "placeholder" | "size"
>;

/** Set an input's value the way typing does, so React and native listeners both hear it. */
function setNativeValue(input: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function ExpandingSearch({
  name,
  label = "Search",
  value,
  onValueChange,
  defaultValue,
  placeholder,
  size = "md",
  width = "18rem",
  shortcut = false,
  defaultOpen = false,
  onOpenChange,
  className,
  inputProps,
  "data-preview": preview,
}: {
  name?: string;
  label?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  size?: "md" | "sm";
  width?: string;
  shortcut?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  inputProps?: InputExtras;
  /** Forces hover or focus for the /ui-kit page only (see globals.css). */
  "data-preview"?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const hasValue = current.length > 0;
  const [unfolded, setUnfolded] = useState(defaultOpen);
  const open = unfolded || hasValue;
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Focus the field once it is visible (it is visibility: hidden while folded).
  const focusNext = useRef(false);
  // A press on the button is under way: Safari does not focus a clicked
  // button, so the field's blur would otherwise fold it before the click.
  const pressing = useRef(false);

  const report = useRef(onOpenChange);
  report.current = onOpenChange;
  const lastOpen = useRef(open);
  useEffect(() => {
    if (lastOpen.current !== open) report.current?.(open);
    lastOpen.current = open;
    if (open && focusNext.current) {
      focusNext.current = false;
      inputRef.current?.focus();
    }
  }, [open]);

  function unfoldAndFocus() {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    focusNext.current = true;
    setUnfolded(true);
  }

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      // Capture phase on window: stopping here keeps the command palette's
      // own "/" listener (window, bubble phase) from opening it as well.
      e.stopPropagation();
      unfoldAndFocus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return (
    <div
      ref={wrapRef}
      data-open={open || undefined}
      data-preview={preview}
      className={cx("xsearch", size === "sm" && "xsearch-sm", className)}
      style={{ "--xsearch-w": width } as CSSProperties}
      onBlur={(e) => {
        // Fold when focus leaves the whole control and nothing is typed.
        if (pressing.current || hasValue) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUnfolded(false);
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="xsearch-toggle"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-keyshortcuts={shortcut ? "/" : undefined}
        title={shortcut ? `${label} (/)` : label}
        onPointerDown={() => {
          // The field's blur runs in this same task (mousedown's default
          // action); clear the mark after it.
          pressing.current = true;
          setTimeout(() => {
            pressing.current = false;
          }, 0);
        }}
        onClick={() => {
          // Open and empty: the button folds it again. Otherwise it opens
          // the field, or returns to it.
          if (open && !hasValue) setUnfolded(false);
          else unfoldAndFocus();
        }}
      >
        <SearchIcon size={size === "sm" ? 14 : 16} />
      </button>
      <input
        {...inputProps}
        ref={inputRef}
        id={id}
        type="search"
        // The form key is the caller's: the form-key guard records it where
        // <ExpandingSearch name="…"> is used.
        name={name}
        value={current}
        placeholder={placeholder}
        aria-label={label}
        tabIndex={open ? inputProps?.tabIndex : -1}
        className={cx("xsearch-input", inputProps?.className)}
        onFocus={(e) => {
          inputProps?.onFocus?.(e);
          // Open because of a value: stay open while it is edited, even
          // when the last character goes, until focus leaves.
          setUnfolded(true);
        }}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value);
          onValueChange?.(e.target.value);
        }}
        onKeyDown={(e) => {
          inputProps?.onKeyDown?.(e);
          if (e.key !== "Escape" || e.defaultPrevented) return;
          // Not the browser's clear-on-Escape: the value stays.
          e.preventDefault();
          if (!hasValue) setUnfolded(false);
          toggleRef.current?.focus();
        }}
      />
      {hasValue ? (
        <button
          type="button"
          className="xsearch-clear"
          aria-label={`Clear ${label.toLowerCase()}`}
          title="Clear"
          onClick={() => {
            const input = inputRef.current;
            if (input) {
              setUnfolded(true);
              setNativeValue(input, "");
              input.focus();
            }
          }}
        >
          <CloseIcon size={14} />
        </button>
      ) : null}
    </div>
  );
}
