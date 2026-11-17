// node --test apps/studio/src/lib/order-move.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { arrowDelta, moveBy, moveOver, sameOrder } from "./order-move.ts";

const abcd = ["a", "b", "c", "d"];

test("a nudge moves one place, and not past either end", () => {
  assert.deepEqual(moveBy(abcd, "a", 1), ["b", "a", "c", "d"]);
  assert.deepEqual(moveBy(abcd, "c", -1), ["a", "c", "b", "d"]);
  // Three forward presses take the first item to the end, one step each.
  let o: readonly string[] = abcd;
  for (let i = 0; i < 3; i++) o = moveBy(o, "a", 1);
  assert.deepEqual(o, ["b", "c", "d", "a"]);
  assert.equal(moveBy(o, "a", 1), o, "the last item cannot go further");
  assert.equal(moveBy(abcd, "a", -1), abcd, "the first item cannot go back");
  assert.equal(moveBy(abcd, "zz", 1), abcd, "an unknown id changes nothing");
  assert.equal(moveBy(abcd, "b", 0), abcd);
});

test("a drag over another item takes its place", () => {
  assert.deepEqual(moveOver(abcd, "a", "c"), ["b", "c", "a", "d"]);
  assert.deepEqual(moveOver(abcd, "d", "a"), ["d", "a", "b", "c"]);
  assert.equal(moveOver(abcd, "a", "a"), abcd);
  assert.equal(moveOver(abcd, "a", "zz"), abcd);
});

test("the grip answers all four arrows, in the card layout too", () => {
  assert.equal(arrowDelta("ArrowLeft"), -1);
  assert.equal(arrowDelta("ArrowUp"), -1);
  assert.equal(arrowDelta("ArrowRight"), 1);
  assert.equal(arrowDelta("ArrowDown"), 1);
  for (const k of ["Enter", " ", "Tab", "a", "Home"]) assert.equal(arrowDelta(k), 0, k);
});

test("moves never change the array they are given", () => {
  const input = [...abcd];
  moveBy(input, "a", 2);
  moveOver(input, "a", "d");
  assert.deepEqual(input, abcd);
  assert.equal(sameOrder(abcd, [...abcd]), true);
  assert.equal(sameOrder(abcd, moveBy(abcd, "a", 1)), false);
});
