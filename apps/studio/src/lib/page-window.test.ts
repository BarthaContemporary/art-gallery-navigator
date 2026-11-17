// node --test apps/studio/src/lib/page-window.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { pageWindow } from "./page-window.ts";

test("few pages are all shown", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(2, 5), [1, 2, 3, 4, 5]);
});

test("first, last and the current page with one either side, gaps between", () => {
  assert.deepEqual(pageWindow(10, 20), [1, "gap", 9, 10, 11, "gap", 20]);
  assert.deepEqual(pageWindow(1, 20), [1, 2, "gap", 20]);
  assert.deepEqual(pageWindow(20, 20), [1, "gap", 19, 20]);
});

test("a gap of one page shows the page instead", () => {
  assert.deepEqual(pageWindow(4, 20), [1, 2, 3, 4, 5, "gap", 20]);
  assert.deepEqual(pageWindow(17, 20), [1, "gap", 16, 17, 18, 19, 20]);
});
