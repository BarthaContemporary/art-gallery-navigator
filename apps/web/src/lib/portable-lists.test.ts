// node --test apps/web/src/lib/portable-lists.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { nestLists, renderedStyle, type ListNode } from "./portable-lists.ts";

type B = { _key: string; listItem?: string; level?: number };
const b = (key: string, listItem: string, level = 1): B => ({ _key: key, listItem, level });

/** A compact picture of the tree: "bullet[a[number[b]],c]". */
function shape(lists: ListNode<B>[]): string {
  return lists
    .map((l) => `${l.type}[${l.items.map((i) => i.block._key + (i.children.length ? `[${shape(i.children)}]` : "")).join(",")}]`)
    .join(" ");
}

test("a flat list stays flat", () => {
  assert.equal(shape(nestLists([b("a", "bullet"), b("b", "bullet")])), "bullet[a,b]");
});

test("a level-2 item nests inside the item before it, not beside it", () => {
  const tree = nestLists([b("a", "bullet"), b("a1", "bullet", 2), b("a2", "bullet", 2), b("c", "bullet")]);
  assert.equal(shape(tree), "bullet[a[bullet[a1,a2]],c]");
});

test("nested lists can be of the other type, and go several levels deep", () => {
  const tree = nestLists([b("a", "bullet"), b("n1", "number", 2), b("x", "bullet", 3), b("n2", "number", 2), b("c", "bullet")]);
  assert.equal(shape(tree), "bullet[a[number[n1[bullet[x]],n2]],c]");
});

test("a change of type at the top level starts a new list", () => {
  assert.equal(shape(nestLists([b("a", "bullet"), b("b", "number"), b("c", "number")])), "bullet[a] number[b,c]");
});

test("a list that starts deep, or skips a level, still renders every item once", () => {
  const tree = nestLists([b("a", "bullet", 2), b("b", "bullet", 4), b("c", "bullet", 3), b("d", "bullet", 1)]);
  assert.equal(shape(tree), "bullet[a[bullet[b] bullet[c]]] bullet[d]");
  assert.deepEqual(nestLists([]), []);
});

test("headings the Studio used to offer map to the site's three sizes", () => {
  assert.equal(renderedStyle("h1"), "h2");
  assert.equal(renderedStyle("h2"), "h2");
  assert.equal(renderedStyle("h5"), "h4");
  assert.equal(renderedStyle("h6"), "h4");
  assert.equal(renderedStyle(undefined), "normal");
  assert.equal(renderedStyle("blockquote"), "blockquote");
});
