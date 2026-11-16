/*
 * Small tests on keyboard and pointer events, shared by the components that
 * handle page-wide keys. Typed on the few fields they read (no DOM types
 * needed), so `node --test` runs them.
 */

type TargetLike = { tagName?: unknown; isContentEditable?: unknown } | null | undefined;

/**
 * True when a key event's target is somewhere the user is typing, so a
 * page-wide shortcut such as "/" must leave the key alone.
 *
 * Besides inputs, text areas, selects and contenteditable, any custom element
 * counts (a custom element's name always holds a hyphen). Keys typed inside a
 * web component's shadow DOM reach window retargeted to its host element:
 * Google's address finder, <gmp-place-autocomplete>, has a closed shadow root,
 * so its host is all the page sees of the field the user is typing in.
 */
export function isEditableTarget(target: unknown): boolean {
  const el = target as TargetLike;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true) return true;
  return tag.includes("-");
}

type KeyLike = { isComposing?: boolean; keyCode?: number; nativeEvent?: { isComposing?: boolean } };

/**
 * True while an input method is composing (Japanese, Chinese, Korean): the
 * Enter that confirms a conversion, and the arrows that move through its
 * candidates, belong to the IME, not to the page. Takes a native event or a
 * React one. keyCode 229 is deprecated but still needed: Safari reports
 * isComposing false on the keydown that ends the composition.
 */
export function isComposing(e: KeyLike): boolean {
  return e.isComposing === true || e.nativeEvent?.isComposing === true || e.keyCode === 229;
}

type ClickLike = { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number };

/**
 * True for a click the browser handles itself (a new tab or window, a
 * download): Cmd, Ctrl, Shift or Alt held, or not the main button. A link
 * click like that does not navigate this tab, so it must not mark the link's
 * page as the one being opened. The same test as Next's own Link.
 */
export function isModifiedClick(e: ClickLike): boolean {
  return Boolean(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) || (typeof e.button === "number" && e.button !== 0);
}
