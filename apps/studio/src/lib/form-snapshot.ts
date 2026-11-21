/**
 * Snapshots of an autosave form, for AutosaveForm: one comparable string per
 * state of the form, a JSON list of [name, value] pairs in form order (the
 * shape lib/record-changes.ts `changedKeys` diffs).
 *
 * Two readings of the same form:
 *
 *  - `formDataEntries`: what a PATCH sends now (`new FormData(form)`).
 *  - `renderedEntries`: what the page was rendered with, read from each
 *    control's defaultValue / defaultChecked / defaultSelected, following the
 *    rules FormData itself uses (names, disabled controls, unticked boxes,
 *    buttons, selects). React sets those defaults to the server's values,
 *    also when it hydrates over values the browser put back.
 *
 * AutosaveForm takes its first "what the server holds" snapshot from the
 * rendered reading, not from the live one. On Back or a reload the browser
 * may restore what was typed before into the fields; React keeps such a
 * value on screen while the defaults keep the server's. Measured from the
 * live form those values would look saved, `_changed` would leave them out,
 * and the record route would never write them although the form shows them.
 * Measured from the rendered defaults they count as edits: the next save
 * lists and writes them, as every save did before `_changed`. A control
 * whose live value differs from its default only through browser value
 * clean-up (a number field holding text, say) is listed once too, which
 * writes it with its current value; after the first successful save the
 * snapshot is the live form as sent.
 *
 * Two kinds of control are read otherwise, because their defaults are not
 * what the server holds:
 *
 *  - A select none of whose options is marked defaultSelected is read as it
 *    is selected now. React builds a controlled `<select value=…>` on the
 *    client (the editor reached by a client navigation, the usual way in)
 *    by setting `selected` only, never `defaultSelected`; its selection when
 *    the form mounts is the stored value, and the browser never restores
 *    into it. A select the server rendered carries React's `selected`
 *    attribute on the stored option, so its default is read as for any
 *    other control.
 *  - A control whose shown value is worked out when the editor opens, not
 *    stored (a GBP purchase with no £ yet shows its cost as the £), carries
 *    the stored value in `data-saved` ("" for none), and that is read
 *    instead of its default. Its shown value then differs from the snapshot
 *    and goes with the first save, which stores it, as every save did
 *    before `_changed`. Read on inputs that hold a value (not boxes, radios
 *    or files) and on textareas.
 *
 * Pure (structural types, no imports), so `node --test` runs it directly.
 */

/** A File as FormData holds it (only what the snapshot reads). */
export type FileLike = { name: string; size: number; lastModified: number };

/**
 * How a file entry appears in a snapshot. An empty file input posts a
 * nameless, empty File stamped with the time FormData was built; it is
 * written without that time so two snapshots of an untouched form agree.
 */
export function fileToken(f: FileLike): string {
  return f.name === "" && f.size === 0 ? "file:" : `file:${f.name}:${f.size}:${f.lastModified}`;
}

export type Entry = [string, string];

/** The posted entries of a FormData (or anything with its forEach), in order. */
export function formDataEntries(fd: {
  forEach(cb: (value: string | FileLike, key: string) => void): void;
}): Entry[] {
  const out: Entry[] = [];
  fd.forEach((value, key) => {
    out.push([key, typeof value === "string" ? value : fileToken(value)]);
  });
  return out;
}

/** A snapshot string from entries. */
export function snapshot(entries: Entry[]): string {
  return JSON.stringify(entries);
}

/** An <option> as the rendered reading needs it (`selected`: chosen now). */
export type OptionLike = { value: string; defaultSelected: boolean; disabled: boolean; selected?: boolean };

/**
 * A listed form control (an element of form.elements), structurally: real
 * HTMLInputElement, HTMLSelectElement, HTMLTextAreaElement, HTMLButtonElement,
 * HTMLFieldSetElement and HTMLOutputElement objects all fit.
 */
export type ControlLike = {
  tagName: string;
  type?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  defaultChecked?: boolean;
  multiple?: boolean;
  options?: ArrayLike<OptionLike>;
  /** el.dataset: `saved` is the stored value of a control whose shown value is worked out on load. */
  dataset?: { readonly saved?: string };
  /** el.matches: disabled through a fieldset, or inside a <datalist>, posts nothing. */
  matches?: (selector: string) => boolean;
};

const NOT_POSTED_TYPES = new Set(["submit", "reset", "button", "image"]);

/** The value a text-like input shows for a default, after the browser's value clean-up. */
function cleanInputValue(type: string, raw: string): string {
  switch (type) {
    case "text":
    case "search":
    case "tel":
    case "password":
      return raw.replace(/[\r\n]/g, "");
    case "email":
    case "url":
      return raw.replace(/[\r\n]/g, "").trim();
    case "number":
      // HTML's "valid floating-point number"; anything else shows as empty.
      return /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(raw) ? raw : "";
    default:
      return raw;
  }
}

/**
 * The entries `new FormData(form)` would hold if every control still showed
 * the value the page was rendered with. Pass `Array.from(form.elements)`.
 */
export function renderedEntries(controls: Iterable<ControlLike>): Entry[] {
  const out: Entry[] = [];
  for (const el of controls) {
    const tag = el.tagName.toUpperCase();
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") continue; // buttons, fieldsets, outputs, objects
    const name = el.name ?? "";
    if (name === "") continue;
    if (el.matches?.(":disabled") || el.matches?.("datalist *")) continue;

    // The stored value of a control whose shown value was worked out on load.
    const saved = el.dataset?.saved;

    if (tag === "TEXTAREA") {
      out.push([name, (saved ?? el.defaultValue ?? "").replace(/\r\n?/g, "\n")]);
      continue;
    }

    if (tag === "SELECT") {
      const options = Array.from(el.options ?? []);
      let selected: boolean[];
      if (!options.some((o) => o.defaultSelected)) {
        // No default marked: a controlled select React built on the client,
        // whose selection now is the stored value (see the header).
        selected = options.map((o) => Boolean(o.selected));
      } else if (el.multiple) {
        selected = options.map((o) => o.defaultSelected);
      } else {
        // One choice: the last option marked selected wins.
        const last = options.map((o) => o.defaultSelected).lastIndexOf(true);
        selected = options.map((_, i) => i === last);
      }
      options.forEach((o, i) => {
        if (selected[i] && !o.disabled) out.push([name, o.value]);
      });
      continue;
    }

    const type = (el.type ?? "text").toLowerCase();
    if (NOT_POSTED_TYPES.has(type)) continue;
    if (type === "checkbox" || type === "radio") {
      if (el.defaultChecked) out.push([name, el.value ?? "on"]);
      continue;
    }
    if (type === "file") {
      out.push([name, "file:"]); // nothing chosen yet
      continue;
    }
    out.push([name, cleanInputValue(type, saved ?? el.defaultValue ?? "")]);
  }
  return out;
}
