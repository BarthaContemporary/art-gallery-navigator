// node --test apps/studio/src/lib/form-snapshot.react.test.ts
//
// The rendered reading (lib/form-snapshot.ts) against real React DOM: the
// form as React builds it on the client (the editor reached by a client
// navigation) and as the server renders it and React hydrates it over
// values the browser put back. React DOM is the studio's own; the DOM is
// jsdom, which the workspace already installs for other packages (found in
// the pnpm store; the test skips if it is not there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { formDataEntries, renderedEntries, snapshot, type ControlLike, type FileLike } from "./form-snapshot.ts";
// @ts-ignore TS5097
import { changedKeys } from "./record-changes.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** jsdom from the workspace's pnpm store, newest first; null when absent. */
function findJsdom(): string | null {
  const store = path.resolve(here, "../../../../node_modules/.pnpm");
  if (!existsSync(store)) return null;
  const dirs = readdirSync(store)
    .filter((d) => d.startsWith("jsdom@"))
    .sort()
    .reverse()
    .map((d) => path.join(store, d, "node_modules/jsdom"))
    .filter((d) => existsSync(path.join(d, "package.json")));
  return dirs[0] ?? null;
}

const jsdomDir = findJsdom();
const skip = jsdomDir ? false : "jsdom is not installed in the workspace";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Env = {
  window: any;
  React: any;
  client: any;
  server: any;
  close(): void;
};

/** A jsdom window as the global DOM, then React DOM loaded against it. */
function setUp(): Env {
  const { JSDOM } = require(jsdomDir!);
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const g = globalThis as any;
  const keys = ["window", "document", "HTMLElement", "HTMLIFrameElement", "Node", "Event", "IS_REACT_ACT_ENVIRONMENT"];
  const before = new Map(keys.map((k) => [k, Object.getOwnPropertyDescriptor(g, k)]));
  for (const k of keys.slice(0, -1)) {
    Object.defineProperty(g, k, { value: k === "window" ? dom.window : k === "document" ? dom.window.document : dom.window[k], configurable: true, writable: true });
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const client = require("react-dom/client");
  const server = require("react-dom/server");
  return {
    window: dom.window,
    React,
    client,
    server,
    close() {
      dom.window.close();
      for (const [k, d] of before) {
        if (d) Object.defineProperty(g, k, d);
        else delete g[k];
      }
    },
  };
}

const VAT = ["margin_scheme", "standard", "zero_rated", "outside_scope"];

/**
 * A slice of the record editor: an uncontrolled title, the controlled VAT
 * select (FinancialsFields), and a controlled Cost £ worked out on load and
 * marked with its stored value (none) as data-saved.
 */
function editor(React: any, storedVat: string) {
  const h = React.createElement;
  return function Editor() {
    const [vat, setVat] = React.useState(storedVat);
    return h(
      "form",
      null,
      h("input", { name: "title", defaultValue: "Tea bowl" }),
      h(
        "select",
        { name: "vat_treatment", value: vat, onChange: (e: any) => setVat(e.target.value) },
        VAT.map((v) => h("option", { key: v, value: v }, v)),
      ),
      h("input", { name: "purchase_cost_gbp", value: "1,250", readOnly: true, "data-saved": "" }),
    );
  };
}

const rendered = (form: any) => snapshot(renderedEntries(Array.from(form.elements as ArrayLike<ControlLike>)));
const live = (env: Env, form: any) =>
  snapshot(
    formDataEntries(
      new env.window.FormData(form) as { forEach(cb: (value: string | FileLike, key: string) => void): void },
    ),
  );

test("a controlled select React builds on the client is read as selected; data-saved as stored", { skip }, async () => {
  const env = setUp();
  try {
    const { React, client, window } = env;
    const container = window.document.createElement("div");
    window.document.body.append(container);
    const root = client.createRoot(container);
    await React.act(async () => root.render(React.createElement(editor(React, "standard"))));
    const form = container.querySelector("form");
    const vat = form.elements.namedItem("vat_treatment");

    // What React does: `selected` on the stored option, no defaultSelected
    // anywhere (the old "first option" reading took margin_scheme).
    assert.equal(vat.value, "standard");
    assert.ok(Array.from(vat.options as ArrayLike<{ defaultSelected: boolean }>).every((o) => !o.defaultSelected));
    assert.equal(form.elements.namedItem("purchase_cost_gbp").dataset.saved, "");

    const baseline = rendered(form);
    assert.deepEqual(JSON.parse(baseline), [
      ["title", "Tea bowl"],
      ["vat_treatment", "standard"],
      ["purchase_cost_gbp", ""],
    ]);

    // The user picks the first option: listed, with the £ shown but not held.
    await React.act(async () => {
      vat.value = "margin_scheme";
      vat.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(vat.value, "margin_scheme");
    assert.deepEqual(changedKeys(baseline, live(env, form)), ["purchase_cost_gbp", "vat_treatment"]);

    await React.act(async () => root.unmount());
  } finally {
    env.close();
  }
});

test("a server-rendered select hydrated over a value the browser restored keeps the stored default", { skip }, async () => {
  const env = setUp();
  try {
    const { React, client, server, window } = env;
    const Editor = editor(React, "standard");
    const container = window.document.createElement("div");
    container.innerHTML = server.renderToString(React.createElement(Editor));
    window.document.body.append(container);
    const form = container.querySelector("form");
    // Back to the page: the browser puts back what was chosen and typed
    // before, ahead of hydration.
    form.elements.namedItem("vat_treatment").value = "zero_rated";
    form.elements.namedItem("title").value = "Tea bowl, Karatsu";
    let root: any;
    await React.act(async () => {
      root = client.hydrateRoot(container, React.createElement(Editor));
    });
    assert.equal(form.elements.namedItem("vat_treatment").value, "zero_rated");

    const baseline = rendered(form);
    assert.deepEqual(JSON.parse(baseline), [
      ["title", "Tea bowl"],
      ["vat_treatment", "standard"],
      ["purchase_cost_gbp", ""],
    ]);
    // The restored values count as edits, so the next save writes them.
    assert.deepEqual(changedKeys(baseline, live(env, form)), ["purchase_cost_gbp", "title", "vat_treatment"]);

    await React.act(async () => root.unmount());
  } finally {
    env.close();
  }
});
