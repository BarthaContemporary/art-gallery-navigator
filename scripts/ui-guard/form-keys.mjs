#!/usr/bin/env node
/**
 * UI guard: form keys.
 *
 * The studio's autosave forms PATCH `new FormData(form)`, and the API routes and
 * server actions read the posted keys by name. An absent checkbox counts as
 * false and an absent field can count as "cleared", so a UI refactor that drops
 * a hidden input, renames a field, disables it, or moves it out of its <form>
 * can silently destroy data. Nothing in the type system catches that.
 *
 * This script reads every .tsx file under apps/studio/src with the TypeScript
 * parser (no type checking, so it is fast and needs no build) and records, per
 * file:
 *
 *   forms     the form roots the file renders: <form> (with its action, method,
 *             encType, id), <AutosaveForm endpoint>, <ContactEditor>,
 *             <CampaignDesigner>, and any formAction override on a button.
 *   fields    every named input, select, textarea and button: name, type,
 *             hidden, plus the attributes that change what FormData carries
 *             (literal value, disabled, multiple, form=, controlled) and the
 *             form root it sits in within the same file. Names passed to a
 *             component as `name="..."`, `names={{ ... }}` (AddressFields) or
 *             `extra={{ ... }}` (DeleteListButton) are recorded too, because
 *             such components only see a variable inside their own file. A
 *             name taken from a constant list (DIMS.map(([k]) => …)) is
 *             expanded to the list's values.
 *   payloads  request bodies built by hand: fetch(url, { body }) with the keys
 *             of a JSON.stringify({...}) object, and `new FormData()` objects
 *             filled with .set/.append (CampaignDesigner, consignment panel,
 *             offer items). These are the same contract without a <form>.
 *
 * Usage (from the repo root):
 *   node scripts/ui-guard/form-keys.mjs            write the baseline
 *   node scripts/ui-guard/form-keys.mjs --update   same
 *   node scripts/ui-guard/form-keys.mjs --check    compare; exit 1 and print the
 *                                                  diff on any difference
 *   pnpm ui:guard / pnpm ui:guard:update           the same via package.json
 *
 * A diff is not necessarily wrong: it means a posted key changed. If the change
 * is intended, make sure the API route and the savePiece action parse the new
 * keys (CLAUDE.md autosave rule), then update the baseline in the same change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCAN_ROOT = "apps/studio/src";
const BASELINE = path.join(REPO, "scripts/ui-guard/form-keys.baseline.json");
const VERSION = 1;

/** Native elements whose `name` ends up in FormData. */
const CONTROLS = new Set(["input", "select", "textarea", "button"]);
/** JSX tags that are, or render, a form whose keys are posted. */
const FORM_ROOTS = new Set(["form", "AutosaveForm", "ContactEditor", "CampaignDesigner"]);
/**
 * Components whose `name` prop is a display label, not a form key (for
 * example DeleteListButton's "Delete <name>?" confirm text).
 */
const NAME_IS_LABEL = new Set(["DeleteListButton"]);
/**
 * Components that turn the keys of an object prop into hidden inputs:
 * DeleteListButton renders one <input type="hidden"> per key of `extra`.
 */
const HIDDEN_KEY_PROPS = new Map([["DeleteListButton", "extra"]]);
/** Attribute text longer than this is summarised, so inline closures don't churn the baseline. */
const MAX_TEXT = 100;

// ---------------------------------------------------------------- file walk

function listTsx(dir) {
  const out = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirent.name === "node_modules" || dirent.name.startsWith(".")) continue;
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...listTsx(full));
    else if (dirent.isFile() && dirent.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- AST helpers

const squash = (s) => s.replace(/\s+/g, " ").trim();

/** Source text of an expression, whitespace-collapsed and length-capped. */
function exprText(node, sf) {
  const t = squash(node.getText(sf));
  return t.length > MAX_TEXT ? "{…}" : `{${t}}`;
}

/** The literal string of an attribute initializer or expression, or null when it is dynamic. */
function literalOf(init) {
  if (!init) return null;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  }
  return null;
}

/** Attribute value as recorded: the literal, or the {expression} text. */
function valueOf(init, sf) {
  const lit = literalOf(init);
  if (lit !== null) return lit;
  if (!init) return true; // bare attribute, e.g. <input hidden />
  if (ts.isJsxExpression(init) && init.expression) return exprText(init.expression, sf);
  return exprText(init, sf);
}

/**
 * Boolean-ish attribute: absent → undefined, bare or {true} → true,
 * {false} → false, anything else → its expression text.
 */
function flagOf(attrs, key, sf) {
  if (!attrs.has(key)) return undefined;
  const init = attrs.get(key);
  if (!init) return true;
  if (ts.isJsxExpression(init) && init.expression) {
    const k = init.expression.kind;
    if (k === ts.SyntaxKind.TrueKeyword) return true;
    if (k === ts.SyntaxKind.FalseKeyword) return false;
  }
  return valueOf(init, sf);
}

function readAttributes(opening) {
  const attrs = new Map();
  const spreads = [];
  for (const prop of opening.attributes.properties) {
    if (ts.isJsxAttribute(prop)) attrs.set(prop.name.getText(), prop.initializer);
    else if (ts.isJsxSpreadAttribute(prop)) spreads.push(prop.expression);
  }
  return { attrs, spreads };
}

const tagOf = (opening, sf) => squash(opening.tagName.getText(sf));
const isIntrinsic = (tag) => /^[a-z]/.test(tag) && !tag.includes(".");

/** Opening (or self-closing) element of every enclosing JSX element, innermost first. */
function enclosingOpenings(node) {
  const out = [];
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxElement(p)) out.push(p.openingElement);
  }
  return out;
}

// ---------------------------------------------------------------- descriptors

/** One-line descriptor of a form root, e.g. `form action={createList}`. */
function describeFormRoot(opening, sf) {
  const tag = tagOf(opening, sf);
  const { attrs } = readAttributes(opening);
  const parts = [tag];
  const keys =
    tag === "form"
      ? ["action", "method", "encType", "id", "target"]
      : tag === "AutosaveForm"
        ? ["endpoint"]
        : [];
  for (const k of keys) {
    if (attrs.has(k)) {
      const v = valueOf(attrs.get(k), sf);
      parts.push(`${k}=${typeof v === "string" && !v.startsWith("{") ? JSON.stringify(v) : v}`);
    }
  }
  if (tag === "form" && attrs.has("onSubmit")) parts.push("onSubmit");
  return parts.join(" ");
}

/** Descriptor for a control that overrides its form's submission (formAction etc.). */
function describeFormOverride(opening, sf) {
  const { attrs } = readAttributes(opening);
  const keys = ["formAction", "formMethod", "formEncType", "formTarget"].filter((k) => attrs.has(k));
  if (!keys.length) return null;
  const parts = [tagOf(opening, sf)];
  for (const k of keys) {
    const v = valueOf(attrs.get(k), sf);
    parts.push(`${k}=${typeof v === "string" && !v.startsWith("{") ? JSON.stringify(v) : v}`);
  }
  return parts.join(" ");
}

/** The nearest form root around `node` in this file, as a descriptor. */
function enclosingForm(node, sf) {
  for (const opening of enclosingOpenings(node)) {
    if (FORM_ROOTS.has(tagOf(opening, sf))) return describeFormRoot(opening, sf);
  }
  return undefined;
}

// ---------------------------------------------------------------- dynamic names

/*
 * A few fields take their name from a constant list, e.g.
 *   DIMS.map(([k, label]) => input(k))   with   const input = (k) => <input name={k} />
 *   [["display_name", …], …].map(([name, …]) => <input name={name} />)
 * Recording only "{k}" would let an entry vanish from DIMS unnoticed, so the
 * guard follows the identifier back to a literal array in the same file when
 * it can (map/forEach callbacks over a const array, and local helper
 * functions called with such values). Anything it cannot follow stays as the
 * expression text.
 */
const unwrap = (e) => {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)))
    e = e.expression;
  return e;
};

/** Path of `target` inside a parameter's binding pattern ([] = the whole parameter). */
function bindingPath(nameNode, target) {
  if (ts.isIdentifier(nameNode)) return nameNode.text === target ? [] : null;
  if (ts.isArrayBindingPattern(nameNode)) {
    for (let i = 0; i < nameNode.elements.length; i++) {
      const el = nameNode.elements[i];
      if (!ts.isBindingElement(el) || el.dotDotDotToken) continue;
      const rest = bindingPath(el.name, target);
      if (rest) return [i, ...rest];
    }
  }
  if (ts.isObjectBindingPattern(nameNode)) {
    for (const el of nameNode.elements) {
      if (el.dotDotDotToken) continue;
      const key = el.propertyName ? el.propertyName.getText() : el.name.getText();
      const rest = bindingPath(el.name, target);
      if (rest) return [key, ...rest];
    }
  }
  return null;
}

/** Elements of a literal array, directly or through a const in this file. */
function arrayElements(expr, sf) {
  const e = unwrap(expr);
  if (!e) return null;
  if (ts.isArrayLiteralExpression(e)) return [...e.elements];
  if (ts.isIdentifier(e)) {
    let found = null;
    const visit = (n) => {
      if (found) return;
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === e.text &&
        n.initializer &&
        n.parent.flags & ts.NodeFlags.Const
      )
        found = n.initializer;
      else ts.forEachChild(n, visit);
    };
    visit(sf);
    return found ? arrayElements(found, sf) : null;
  }
  return null;
}

/** The string at `path` inside a literal element, or null. */
function pick(el, path) {
  const e = unwrap(el);
  if (!e) return null;
  if (!path.length) return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null;
  const [head, ...rest] = path;
  if (typeof head === "number" && ts.isArrayLiteralExpression(e)) return pick(e.elements[head], rest);
  if (typeof head === "string" && ts.isObjectLiteralExpression(e)) {
    for (const p of e.properties) {
      if (ts.isPropertyAssignment(p) && p.name.getText().replace(/^["']|["']$/g, "") === head)
        return pick(p.initializer, rest);
    }
  }
  return null;
}

/** Every literal value `expr` can take, or null when it cannot be followed. */
function resolveNames(expr, sf, depth = 0) {
  const e = unwrap(expr);
  if (!e || depth > 3) return null;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (!ts.isIdentifier(e)) return null;
  for (let fn = e.parent; fn; fn = fn.parent) {
    if (!ts.isFunctionLike(fn) || !fn.parameters) continue;
    for (let i = 0; i < fn.parameters.length; i++) {
      const path = bindingPath(fn.parameters[i].name, e.text);
      if (path) return resolveParam(fn, i, path, sf, depth);
    }
  }
  return null;
}

function resolveParam(fn, index, path, sf, depth) {
  // A callback over a literal list: LIST.map(([k]) => …)
  const call = fn.parent;
  if (
    index === 0 &&
    ts.isCallExpression(call) &&
    call.arguments[0] === fn &&
    ts.isPropertyAccessExpression(call.expression) &&
    ["map", "flatMap", "forEach"].includes(call.expression.name.text)
  ) {
    const items = arrayElements(call.expression.expression, sf);
    if (!items) return null;
    const out = [];
    for (const item of items) {
      const v = pick(item, path);
      if (v === null) return null;
      out.push(v);
    }
    return out;
  }
  // A local helper: const input = (k) => <input name={k} />, called as input(k).
  if (path.length) return null;
  const fname =
    ts.isFunctionDeclaration(fn) && fn.name
      ? fn.name.text
      : ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name)
        ? fn.parent.name.text
        : null;
  if (!fname) return null;
  const out = [];
  let ok = true;
  let calls = 0;
  const visit = (n) => {
    if (!ok) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === fname) {
      calls++;
      const r = n.arguments[index] ? resolveNames(n.arguments[index], sf, depth + 1) : null;
      if (r) out.push(...r);
      else ok = false;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return ok && calls ? out : null;
}

/** Fixed key order, undefined dropped, so entries serialise identically every run. */
function entry(fields) {
  const order = [
    "name", "from", "tag", "via", "prop", "type", "hidden", "value",
    "controlled", "disabled", "multiple", "form", "in",
  ];
  const out = {};
  for (const k of order) if (fields[k] !== undefined) out[k] = fields[k];
  return out;
}

/** A named native control → field entries (several when a dynamic name resolves to a list). */
function nativeFields(opening, sf) {
  const tag = tagOf(opening, sf);
  const { attrs, spreads } = readAttributes(opening);
  let name;
  let resolved = null;
  if (attrs.has("name")) {
    const init = attrs.get("name");
    name = valueOf(init, sf);
    if (typeof name === "string" && name.startsWith("{") && init && ts.isJsxExpression(init) && init.expression)
      resolved = resolveNames(init.expression, sf);
  } else if (spreads.length) name = spreads.map((s) => `{...${squash(s.getText(sf))}}`).join(" ");
  else return []; // unnamed: never posted

  let type;
  if (tag === "select") type = "select";
  else if (tag === "textarea") type = "textarea";
  else if (attrs.has("type")) type = valueOf(attrs.get("type"), sf);
  else type = tag === "button" ? "submit" : "text";

  const hiddenAttr = flagOf(attrs, "hidden", sf);
  const hidden = type === "hidden" ? true : hiddenAttr === undefined ? false : hiddenAttr;

  // A literal value is part of the contract (hidden ids, intents, checkbox values).
  const value = attrs.has("value") ? literalOf(attrs.get("value")) ?? undefined : undefined;

  // Controlled = React owns the value. Turning an uncontrolled field into a
  // controlled one (or back) is how a refactor can post stale or empty values.
  let controlled;
  if (type === "checkbox" || type === "radio") controlled = attrs.has("checked") || undefined;
  else if (tag !== "button" && type !== "hidden" && type !== "submit" && type !== "button")
    controlled = (attrs.has("value") && literalOf(attrs.get("value")) === null) || undefined;

  const rest = {
    tag,
    type,
    hidden,
    value,
    controlled,
    disabled: flagOf(attrs, "disabled", sf),
    multiple: flagOf(attrs, "multiple", sf),
    form: attrs.has("form") ? valueOf(attrs.get("form"), sf) : undefined,
    in: enclosingForm(opening, sf),
  };
  if (resolved) return resolved.map((n) => entry({ name: n, from: name, ...rest }));
  return [entry({ name, ...rest })];
}

/** Field names handed to a component (`name="x"`, `names={{ a: "x" }}`, `extra={{ x: … }}`). */
function componentFields(opening, sf) {
  const tag = tagOf(opening, sf);
  if (FORM_ROOTS.has(tag)) return [];
  const { attrs } = readAttributes(opening);
  const out = [];
  const typeAttr = attrs.has("type") ? valueOf(attrs.get("type"), sf) : undefined;
  const common = {
    via: tag,
    type: typeAttr,
    hidden: typeAttr === "hidden" ? true : flagOf(attrs, "hidden", sf) ?? false,
    disabled: flagOf(attrs, "disabled", sf),
    in: enclosingForm(opening, sf),
  };
  const lit = attrs.has("name") && !NAME_IS_LABEL.has(tag) ? literalOf(attrs.get("name")) : null;
  if (lit !== null) out.push(entry({ name: lit, ...common }));

  const keyProp = HIDDEN_KEY_PROPS.get(tag);
  const keyInit = keyProp ? attrs.get(keyProp) : undefined;
  if (keyInit && ts.isJsxExpression(keyInit) && keyInit.expression) {
    const obj = unwrap(keyInit.expression);
    if (ts.isObjectLiteralExpression(obj)) {
      for (const k of objectKeys(obj, sf)) {
        out.push(entry({ name: k, ...common, prop: `${keyProp}.${k}`, type: "hidden", hidden: true }));
      }
    }
  }

  const namesInit = attrs.get("names");
  if (namesInit && ts.isJsxExpression(namesInit) && namesInit.expression) {
    const obj = namesInit.expression;
    if (ts.isObjectLiteralExpression(obj)) {
      for (const p of obj.properties) {
        if (!ts.isPropertyAssignment(p)) continue;
        const v = p.initializer;
        if (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) {
          out.push(entry({ name: v.text, ...common, prop: `names.${squash(p.name.getText(sf))}` }));
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- payloads

function objectKeys(obj, sf) {
  return obj.properties
    .map((p) => {
      if (ts.isSpreadAssignment(p)) return `...${squash(p.expression.getText(sf))}`;
      if (p.name && ts.isComputedPropertyName(p.name)) return squash(p.name.getText(sf));
      if (p.name) return literalPropName(p.name, sf);
      return squash(p.getText(sf));
    })
    .sort();
}

function literalPropName(name, sf) {
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return squash(name.getText(sf));
}

function propOf(obj, key) {
  for (const p of obj.properties) {
    if (ts.isShorthandPropertyAssignment(p) && p.name.text === key) return p.name;
    if (ts.isPropertyAssignment(p) && p.name && !ts.isComputedPropertyName(p.name) && p.name.text === key)
      return p.initializer;
  }
  return undefined;
}

/** Nearest function body (or the file) around a node: the scope a FormData variable lives in. */
function scopeOf(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return p;
  }
  return node.getSourceFile();
}

/** Keys set or appended on `ident` within `scope`, in source order (sorted by the caller). */
function formDataKeys(scope, ident, sf) {
  const keys = [];
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === ident &&
      ["set", "append"].includes(n.expression.name.text)
    ) {
      const k = n.arguments[0];
      keys.push(k && (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) ? k.text : k ? exprText(k, sf) : "?");
    }
    ts.forEachChild(n, visit);
  };
  visit(scope);
  return keys.sort();
}

function bodyDescriptor(body, sf) {
  if (ts.isCallExpression(body) && squash(body.expression.getText(sf)) === "JSON.stringify") {
    const arg = body.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) return { body: "json", keys: objectKeys(arg, sf) };
    return { body: "json", keys: [arg ? exprText(arg, sf) : "?"] };
  }
  if (ts.isNewExpression(body) && squash(body.expression.getText(sf)) === "FormData") {
    const arg = body.arguments?.[0];
    return { body: "form", source: arg ? exprText(arg, sf) : "{new FormData()}" };
  }
  return { body: exprText(body, sf) };
}

function collectPayloads(sf) {
  const payloads = [];
  const visit = (n) => {
    // fetch(url, { method, body })
    if (ts.isCallExpression(n)) {
      const callee = squash(n.expression.getText(sf));
      if ((callee === "fetch" || callee === "window.fetch") && n.arguments.length >= 2) {
        const init = n.arguments[1];
        if (ts.isObjectLiteralExpression(init)) {
          const body = propOf(init, "body");
          if (body) {
            const method = propOf(init, "method");
            payloads.push(
              entry2({
                kind: "fetch",
                method: method ? literalOf(method) ?? exprText(method, sf) : "GET",
                url: literalOf(n.arguments[0]) ?? exprText(n.arguments[0], sf),
                ...bodyDescriptor(body, sf),
              }),
            );
          }
        }
      }
    }
    // const fd = new FormData();  fd.set("k", …)
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      ts.isNewExpression(n.initializer) &&
      squash(n.initializer.expression.getText(sf)) === "FormData" &&
      !(n.initializer.arguments && n.initializer.arguments.length)
    ) {
      payloads.push(
        entry2({ kind: "FormData", var: n.name.text, keys: formDataKeys(scopeOf(n), n.name.text, sf) }),
      );
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return payloads;
}

function entry2(fields) {
  const order = ["kind", "method", "url", "var", "body", "source", "keys"];
  const out = {};
  for (const k of order) if (fields[k] !== undefined) out[k] = fields[k];
  return out;
}

// ---------------------------------------------------------------- per file

function scanFile(abs) {
  const text = fs.readFileSync(abs, "utf8");
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const forms = [];
  const fields = [];

  const visit = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = tagOf(n, sf);
      if (FORM_ROOTS.has(tag)) forms.push(describeFormRoot(n, sf));
      const override = describeFormOverride(n, sf);
      if (override) forms.push(override);
      if (isIntrinsic(tag)) {
        if (CONTROLS.has(tag)) {
          fields.push(...nativeFields(n, sf));
        }
      } else {
        fields.push(...componentFields(n, sf));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);

  const payloads = collectPayloads(sf);
  if (!forms.length && !fields.length && !payloads.length) return null;

  const byJson = (a, b) => {
    const x = JSON.stringify(a);
    const y = JSON.stringify(b);
    return x < y ? -1 : x > y ? 1 : 0;
  };
  return {
    forms: forms.sort(),
    fields: fields.sort(byJson),
    payloads: payloads.sort(byJson),
  };
}

function scan() {
  const root = path.join(REPO, SCAN_ROOT);
  const files = {};
  for (const abs of listTsx(root).sort()) {
    const rel = path.relative(root, abs).split(path.sep).join("/");
    const result = scanFile(abs);
    if (result) files[rel] = result;
  }
  return {
    $comment:
      "Generated by scripts/ui-guard/form-keys.mjs. Do not edit by hand: run `pnpm ui:guard:update` after an intended change to a posted key, and commit this file with that change.",
    version: VERSION,
    root: SCAN_ROOT,
    files,
  };
}

// ---------------------------------------------------------------- diff

/** Multiset difference of serialised entries: what is in `a` and not in `b`. */
function minus(a, b) {
  const counts = new Map();
  for (const x of b) counts.set(x, (counts.get(x) ?? 0) + 1);
  const out = [];
  for (const x of a) {
    const c = counts.get(x) ?? 0;
    if (c > 0) counts.set(x, c - 1);
    else out.push(x);
  }
  return out;
}

function diff(base, next) {
  const lines = [];
  if (base.version !== next.version || base.root !== next.root) {
    lines.push(`baseline format changed (version ${base.version} → ${next.version}, root ${base.root} → ${next.root})`);
  }
  const names = [...new Set([...Object.keys(base.files ?? {}), ...Object.keys(next.files)])].sort();
  for (const file of names) {
    const a = base.files?.[file];
    const b = next.files[file];
    if (!a) {
      lines.push(`\n+ ${file} (new file with form keys)`);
    } else if (!b) {
      lines.push(`\n- ${file} (no longer renders any form keys, or was moved)`);
    }
    const section = [];
    for (const part of ["forms", "fields", "payloads"]) {
      const before = (a?.[part] ?? []).map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
      const after = (b?.[part] ?? []).map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
      const removed = minus(before, after);
      const added = minus(after, before);
      for (const r of removed) section.push(`    - ${part.slice(0, -1)} ${r}`);
      for (const x of added) section.push(`    + ${part.slice(0, -1)} ${x}`);
    }
    if (section.length) {
      if (a && b) lines.push(`\n~ ${file}`);
      lines.push(...section);
    }
  }
  return lines;
}

// ---------------------------------------------------------------- main

const args = new Set(process.argv.slice(2));
const usage = "usage: node scripts/ui-guard/form-keys.mjs [--check | --update]";
if (args.has("--help") || args.has("-h")) {
  console.log(usage);
  process.exit(0);
}
// A mistyped --check must not fall through to rewriting the baseline (and pass).
const unknown = [...args].filter((a) => a !== "--check" && a !== "--update");
if (unknown.length || (args.has("--check") && args.has("--update"))) {
  console.error(`ui-guard: unexpected arguments ${[...args].join(" ")}\n${usage}`);
  process.exit(2);
}

const next = scan();
const count = Object.keys(next.files).length;
const fieldCount = Object.values(next.files).reduce((n, f) => n + f.fields.length, 0);

if (args.has("--check")) {
  if (!fs.existsSync(BASELINE)) {
    console.error(`ui-guard: no baseline at ${path.relative(REPO, BASELINE)}. Run \`pnpm ui:guard:update\` first.`);
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const lines = diff(base, next);
  if (lines.length) {
    console.error("ui-guard: form keys differ from scripts/ui-guard/form-keys.baseline.json");
    console.error("(- in the baseline, + in the code now)");
    console.error(lines.join("\n"));
    console.error(
      "\nA posted form key, its type or its form changed. If this is intended, check that the API" +
        "\nroute and the savePiece action parse it (CLAUDE.md autosave rule), then run" +
        "\n`pnpm ui:guard:update` and commit the baseline with the change.",
    );
    process.exit(1);
  }
  console.log(`ui-guard: form keys unchanged (${count} files, ${fieldCount} named fields).`);
} else {
  fs.writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`ui-guard: wrote ${path.relative(REPO, BASELINE)} (${count} files, ${fieldCount} named fields).`);
}
