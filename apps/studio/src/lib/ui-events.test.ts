// node --test apps/studio/src/lib/ui-events.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isComposing, isEditableTarget, isModifiedClick } from "./ui-events.ts";

test("fields and contenteditable are editable", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT", "input"]) {
    assert.equal(isEditableTarget({ tagName }), true, tagName);
  }
  assert.equal(isEditableTarget({ tagName: "DIV", isContentEditable: true }), true);
});

test("a custom element's host counts as a field (the address finder)", () => {
  assert.equal(isEditableTarget({ tagName: "GMP-PLACE-AUTOCOMPLETE" }), true);
  assert.equal(isEditableTarget({ tagName: "gmp-place-autocomplete" }), true);
});

test("the page itself, buttons and links are not", () => {
  for (const tagName of ["BODY", "BUTTON", "A", "DIV"]) {
    assert.equal(isEditableTarget({ tagName, isContentEditable: false }), false, tagName);
  }
  assert.equal(isEditableTarget(null), false);
  // window and document have no tagName.
  assert.equal(isEditableTarget({}), false);
});

test("composition is seen on native and React events, and through keyCode 229", () => {
  assert.equal(isComposing({ isComposing: true }), true);
  assert.equal(isComposing({ nativeEvent: { isComposing: true } }), true);
  assert.equal(isComposing({ keyCode: 229, nativeEvent: { isComposing: false } }), true);
  assert.equal(isComposing({ keyCode: 13, nativeEvent: { isComposing: false } }), false);
  assert.equal(isComposing({}), false);
});

test("modified clicks are the browser's", () => {
  assert.equal(isModifiedClick({ button: 0 }), false);
  assert.equal(isModifiedClick({}), false);
  assert.equal(isModifiedClick({ metaKey: true, button: 0 }), true);
  assert.equal(isModifiedClick({ ctrlKey: true }), true);
  assert.equal(isModifiedClick({ shiftKey: true }), true);
  assert.equal(isModifiedClick({ altKey: true }), true);
  assert.equal(isModifiedClick({ button: 1 }), true);
});
