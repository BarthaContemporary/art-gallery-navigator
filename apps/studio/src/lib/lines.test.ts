// node --test apps/studio/src/lib/lines.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { serialiseLines } from "./lines.ts";

test("lines post as a JSON array of trimmed, non-empty strings", () => {
  assert.equal(serialiseLines([]), "[]");
  assert.equal(serialiseLines(["  Asia Week London, 2026 ", "", "   "]), JSON.stringify(["Asia Week London, 2026"]));
  assert.deepEqual(JSON.parse(serialiseLines(["a", " b ", "c"])), ["a", "b", "c"]);
  // An added blank row changes nothing that is posted.
  assert.equal(serialiseLines(["a", ""]), serialiseLines(["a"]));
});

test("the list's hidden field is controlled by its rows, never a hand-written defaultValue", () => {
  // For a hidden input the value is the default value, so React DOM writes
  // its defaultValue prop back on every re-render: a hand-set value was
  // replaced by the initial list and edits never posted (review finding
  // studio-components-editor-1). The field must take value={json}.
  const src = readFileSync(new URL("../components/repeatable-list.tsx", import.meta.url), "utf8");
  const hidden = src.match(/<input[^>]*type="hidden"[^>]*\/>/s)?.[0] ?? "";
  assert.match(hidden, /name=\{name\}/);
  assert.match(hidden, /value=\{json\}/);
  assert.doesNotMatch(hidden, /defaultValue/);
  assert.doesNotMatch(src, /hidden\.current\.value\s*=/);
  assert.match(src, /serialiseLines\(rows\)/);
});
