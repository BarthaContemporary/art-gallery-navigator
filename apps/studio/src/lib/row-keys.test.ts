// node --test apps/studio/src/lib/row-keys.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-ignore TS5097 -- node --test needs the extension, which the app's tsconfig does not allow
import { enterBelongsToTarget, OWN_ENTER_SELECTOR } from "./row-keys.ts";

/** A stand-in element: `closest` finds itself or an ancestor by tag or role. */
function el(tag: string, attrs: Record<string, string> = {}, parent: unknown = null) {
  const node = {
    tag,
    attrs,
    parent,
    closest(selector: string): unknown {
      for (let n: typeof node | null = node; n; n = n.parent as typeof node | null) {
        for (const part of selector.split(",").map((s) => s.trim())) {
          const role = part.match(/^\[role=(\w+)\]$/)?.[1];
          if (role ? n.attrs.role === role : part === "a[href]" ? n.tag === "a" && "href" in n.attrs : n.tag === part) {
            return n;
          }
        }
      }
      return null;
    },
  };
  return node;
}

test("Enter on a link, a button or a menu item is that control's", () => {
  assert.equal(enterBelongsToTarget(el("a", { href: "/inventory?page=2" })), true);
  assert.equal(enterBelongsToTarget(el("button")), true);
  assert.equal(enterBelongsToTarget(el("summary")), true);
  assert.equal(enterBelongsToTarget(el("div", { role: "menuitem" })), true);
  // The icon inside a button.
  assert.equal(enterBelongsToTarget(el("svg", {}, el("button"))), true);
});

test("Enter anywhere else opens the highlighted row", () => {
  assert.equal(enterBelongsToTarget(el("body")), false);
  assert.equal(enterBelongsToTarget(el("td", {}, el("tr"))), false);
  // A link with no href is not a link.
  assert.equal(enterBelongsToTarget(el("a")), false);
  // The window and the document have no closest().
  assert.equal(enterBelongsToTarget({}), false);
  assert.equal(enterBelongsToTarget(null), false);
  assert.ok(OWN_ENTER_SELECTOR.includes("a[href]"));
});
