// node --test apps/studio/src/lib/form-snapshot.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { fileToken, formDataEntries, renderedEntries, snapshot, type ControlLike } from "./form-snapshot.ts";
// @ts-ignore TS5097
import { CHANGED_FIELD, changedKeys, readChangedKeys } from "./record-changes.ts";

/*
 * A small stand-in for the record editor's form. Each control has a live
 * value (what FormData posts now) and a default (what the server rendered).
 */
type Fake = ControlLike & { live?: string | boolean | number[]; disabledFlag?: boolean; inDatalist?: boolean };

const input = (name: string, def: string, extra: Partial<Fake> = {}): Fake => ({
  tagName: "INPUT",
  type: "text",
  name,
  defaultValue: def,
  ...extra,
  matches: (sel: string) =>
    sel === ":disabled" ? Boolean(extra.disabledFlag) : sel === "datalist *" ? Boolean(extra.inDatalist) : false,
});
const box = (name: string, def: boolean, extra: Partial<Fake> = {}): Fake =>
  input(name, "", { type: "checkbox", value: "on", defaultChecked: def, ...extra });
const select = (name: string, values: string[], def: number | null, extra: Partial<Fake> = {}): Fake =>
  input(name, "", {
    tagName: "SELECT",
    type: "select-one",
    options: values.map((v, i) => ({ value: v, defaultSelected: i === def, disabled: false })),
    ...extra,
  });
const textarea = (name: string, def: string): Fake => input(name, def, { tagName: "TEXTAREA", type: "textarea" });

/** What FormData would post if the browser had changed nothing (the live reading, by hand). */
function liveEntries(controls: Fake[]): [string, string][] {
  return renderedEntries(
    controls.map((c) => {
      if (c.live === undefined) return c;
      if (c.tagName === "SELECT" && Array.isArray(c.live)) {
        const chosen = c.live;
        return { ...c, options: Array.from(c.options ?? [], (o, i) => ({ ...o, defaultSelected: chosen.includes(i) })) };
      }
      if (typeof c.live === "boolean") return { ...c, defaultChecked: c.live };
      return { ...c, defaultValue: String(c.live) };
    }),
  );
}

test("the rendered reading follows FormData's rules", () => {
  const controls: Fake[] = [
    input("title", "Tea bowl"),
    input("", "no name posts nothing"),
    input("medium", "Stoneware", { disabledFlag: true }), // disabled, or inside a disabled fieldset
    input("hint", "x", { inDatalist: true }),
    { tagName: "BUTTON", type: "submit", name: "go", value: "1" },
    input("submit_as", "", { type: "submit", value: "Save" }),
    { tagName: "FIELDSET", type: "fieldset", name: "group" },
    box("web_visible", true),
    box("framed", false),
    input("year", "2024\n-26"), // a text field shows no line breaks
    input("height_cm", "abc", { type: "number" }), // not a number: shows empty
    input("width_cm", "12.5", { type: "number" }),
    input("site", "  https://example.com ", { type: "url" }),
    select("status", ["in_stock", "sold"], 1),
    select("location_id", ["", "loc-1"], null), // nothing marked: the first option
    textarea("description", "Line one\r\nLine two"),
    input("scan", "", { type: "file" }),
    input("radio_a", "", { type: "radio", value: "flat", defaultChecked: true, name: "presentation" }),
  ];
  assert.deepEqual(renderedEntries(controls), [
    ["title", "Tea bowl"],
    ["web_visible", "on"],
    ["year", "2024-26"],
    ["height_cm", ""],
    ["width_cm", "12.5"],
    ["site", "https://example.com"],
    ["status", "sold"],
    ["location_id", ""],
    ["description", "Line one\nLine two"],
    ["scan", "file:"],
    ["presentation", "flat"],
  ]);
});

test("selects: the last marked option wins, disabled options post nothing, multiples post each", () => {
  const one = select("status", ["a", "b", "c"], null, {
    options: [
      { value: "a", defaultSelected: true, disabled: false },
      { value: "b", defaultSelected: false, disabled: false },
      { value: "c", defaultSelected: true, disabled: false },
    ],
  });
  const firstEnabled = select("loc", ["x", "y"], null, {
    options: [
      { value: "x", defaultSelected: false, disabled: true },
      { value: "y", defaultSelected: false, disabled: false },
    ],
  });
  const many = select("tags", [], null, {
    type: "select-multiple",
    multiple: true,
    options: [
      { value: "t1", defaultSelected: true, disabled: false },
      { value: "t2", defaultSelected: false, disabled: false },
      { value: "t3", defaultSelected: true, disabled: true },
      { value: "t4", defaultSelected: true, disabled: false },
    ],
  });
  const noneInList = select("pick", ["p", "q"], null, { size: 4 });
  assert.deepEqual(renderedEntries([one, firstEnabled, many, noneInList]), [
    ["status", "c"],
    ["loc", "y"],
    ["tags", "t1"],
    ["tags", "t4"],
  ]);
});

test("an untouched form: the rendered and live snapshots agree, so nothing is listed as changed", () => {
  const controls = [input("title", "Tea bowl"), box("web_visible", true), select("status", ["in_stock", "sold"], 0)];
  const rendered = snapshot(renderedEntries(controls));
  assert.equal(snapshot(liveEntries(controls)), rendered);
  assert.deepEqual(changedKeys(rendered, snapshot(liveEntries(controls))), []);
});

test("values the browser restored after Back count as changed against the rendered snapshot", () => {
  // The server rendered the record as it is now; the browser put back what
  // was typed into this page before (React keeps it on screen at hydration).
  const controls: Fake[] = [
    input("title", "Tea bowl", { live: "Tea bowl, Karatsu" }),
    box("web_visible", true, { live: false }),
    select("status", ["in_stock", "sold"], 0),
    input("comments", ""),
  ];
  const rendered = snapshot(renderedEntries(controls));
  const afterMount = snapshot(liveEntries(controls));
  // Taken from the live form at mount, the restored values would look saved:
  assert.deepEqual(changedKeys(afterMount, afterMount), []);
  // Taken from the defaults, the first save lists them with the new edit.
  const edited = liveEntries(controls).map(([k, v]): [string, string] => (k === "comments" ? [k, "Kiln mark"] : [k, v]));
  assert.deepEqual(changedKeys(rendered, snapshot(edited)), ["comments", "title", "web_visible"]);
});

test("the posted list is what the record route reads back", () => {
  const before = snapshot([["title", "a"], ["status", "in_stock"]]);
  const after = snapshot([["title", "b"], ["status", "in_stock"]]);
  const body = new FormData();
  body.set("title", "b");
  body.set("status", "in_stock");
  const names = changedKeys(before, after);
  assert.ok(names);
  body.set(CHANGED_FIELD, JSON.stringify(names));
  assert.deepEqual([...(readChangedKeys(body) ?? [])], ["title"]);
  // The appended key is not itself a field of the next snapshot.
  assert.deepEqual(formDataEntries(body).map(([k]) => k), ["title", "status", CHANGED_FIELD]);
  assert.deepEqual(changedKeys(snapshot(formDataEntries(body)), snapshot(formDataEntries(body))), []);
});

test("an empty file input reads the same every time; a chosen file by name, size and date", () => {
  assert.equal(fileToken({ name: "", size: 0, lastModified: Date.now() }), "file:");
  assert.equal(fileToken({ name: "", size: 0, lastModified: 1 }), fileToken({ name: "", size: 0, lastModified: 2 }));
  assert.equal(fileToken({ name: "a.jpg", size: 10, lastModified: 5 }), "file:a.jpg:10:5");
  const fd = new FormData();
  fd.append("scan", new File([], "", { type: "application/octet-stream" }));
  fd.append("note", "x");
  assert.deepEqual(formDataEntries(fd), [
    ["scan", "file:"],
    ["note", "x"],
  ]);
});

test("a snapshot that cannot be read sends no list (the route writes every field)", () => {
  assert.equal(changedKeys(null, snapshot([["title", "a"]])), null);
});
