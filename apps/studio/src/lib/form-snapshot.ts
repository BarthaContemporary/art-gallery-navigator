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

/** An <option> as the rendered reading needs it. */
export type OptionLike = { value: string; defaultSelected: boolean; disabled: boolean };

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
  size?: number;
  options?: ArrayLike<OptionLike>;
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

    if (tag === "TEXTAREA") {
      out.push([name, (el.defaultValue ?? "").replace(/\r\n?/g, "\n")]);
      continue;
    }

    if (tag === "SELECT") {
      const options = Array.from(el.options ?? []);
      let selected = options.map((o) => o.defaultSelected);
      const listbox = el.multiple || (el.size ?? 0) > 1;
      if (!el.multiple) {
        // One choice: the last option marked selected wins; with none
        // marked, a drop-down shows its first option that is not disabled.
        const last = selected.lastIndexOf(true);
        selected = options.map((_, i) => i === last);
        if (last < 0 && !listbox) {
          const first = options.findIndex((o) => !o.disabled);
          if (first >= 0) selected[first] = true;
        }
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
    out.push([name, cleanInputValue(type, el.defaultValue ?? "")]);
  }
  return out;
}
