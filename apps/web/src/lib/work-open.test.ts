// node --test apps/web/src/lib/work-open.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { WORK_OPEN_EVENT, openWork, workOnThisPage } from "./work-open.ts";

const PAGE = "https://example.test/events/tefaf-maastricht-2026";

test("a work hit on the page already shown opens in place", () => {
  assert.equal(workOnThisPage("/events/tefaf-maastricht-2026?work=abc", PAGE), "abc");
  assert.equal(workOnThisPage("/events/tefaf-maastricht-2026?work=abc", `${PAGE}?work=old#works`), "abc");
  assert.equal(workOnThisPage("/events/tefaf-maastricht-2026?work=a%20b", PAGE), "a b");
});

test("hits on other pages, or without a work, navigate as usual", () => {
  assert.equal(workOnThisPage("/events/other-fair?work=abc", PAGE), null);
  assert.equal(workOnThisPage("/artists/hozan?work=abc", PAGE), null);
  assert.equal(workOnThisPage("/events/tefaf-maastricht-2026", PAGE), null);
  assert.equal(workOnThisPage("/events/tefaf-maastricht-2026?work=", PAGE), null);
  assert.equal(workOnThisPage("https://elsewhere.test/events/tefaf-maastricht-2026?work=abc", PAGE), null);
});

test("openWork is true only when a grid on the page takes the work", () => {
  const prev = (globalThis as { window?: unknown }).window;
  const win = new EventTarget();
  (globalThis as { window?: unknown }).window = win;
  try {
    // No grid listening: the overlay must navigate.
    assert.equal(openWork("abc"), false);

    const held = new Set(["abc"]);
    const seen: string[] = [];
    const grid = (e: Event) => {
      const id = (e as CustomEvent<unknown>).detail;
      if (typeof id !== "string" || !held.has(id)) return;
      seen.push(id);
      e.preventDefault();
    };
    win.addEventListener(WORK_OPEN_EVENT, grid);
    assert.equal(openWork("abc"), true);
    // A grid that does not hold the work leaves it to the navigation.
    assert.equal(openWork("xyz"), false);
    assert.deepEqual(seen, ["abc"]);
    win.removeEventListener(WORK_OPEN_EVENT, grid);
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});
