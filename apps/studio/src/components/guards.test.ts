// node --test apps/studio/src/components/guards.test.ts
//
// Small guards in client components that node --test cannot render (they are
// .tsx): checked on the source, as save-outcome.test.ts does for AutosaveForm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const component = (name: string) => readFileSync(path.join(here, name), "utf8");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

test("AutosaveForm: the first snapshot is the form as rendered, and every send says what changed", () => {
  const src = component("autosave-form.tsx");
  assert.match(src, /lastSaved\.current = serialiseAsRendered\(formRef\.current\)/);
  // save(): the list against what the server holds, on the body it sends.
  assert.match(src, /const body = new FormData\(formRef\.current\);\n\s+markChanged\(body, lastSaved\.current, sent\);/);
  assert.match(src, /fetch\(endpoint, \{ method: "PATCH", body \}\)/);
  // The keepalive flush on leaving does the same.
  const flush = src.match(/const flushOnLeave = useCallback\([\s\S]*?\n  \);/)?.[0] ?? "";
  assert.match(flush, /markChanged\(body, lastSaved\.current, now\);/);
  // lastSaved moves only when a save succeeded, so a retry still lists the earlier changes.
  const assigns = src.match(/lastSaved\.current = [^;]+;/g) ?? [];
  assert.deepEqual(assigns, ["lastSaved.current = serialiseAsRendered(formRef.current);", "lastSaved.current = sent;"]);
  assert.match(src, /if \(outcome\.ok\) \{[\s\S]*?lastSaved\.current = sent;/);
});

test("FinancialsFields: a Cost £ worked out on load carries its stored value (none), so the first save stores it", () => {
  const src = component("financials-fields.tsx");
  assert.match(src, /const openingGbp = useMemo\(\n\s+\(\) => openingPurchaseGbp\(\{ cost: d\("purchase_cost"\), currency: loadedPurchaseCur, gbp: d\("purchase_cost_gbp"\) \}\),/);
  assert.match(src, /const \[costGbp, setCostGbp\] = useState\(openingGbp\.shown\);/);
  const costField = src.match(/<AmountInput\n\s+id="fin-cost-gbp"[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(costField, /name="purchase_cost_gbp"\n\s+value=\{costGbp\}\n\s+data-saved=\{openingGbp\.derived \? "" : undefined\}/);
  // AmountInput hands the attribute on to its <input>.
  assert.match(component("amount-input.tsx"), /<input\n\s+\{\.\.\.rest\}/);
});

test("amount-input keeps format to itself, and nothing imports it", () => {
  assert.doesNotMatch(component("amount-input.tsx"), /export function format\b/);
  const studio = path.join(here, "..");
  for (const file of sources(studio)) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /import \{[^}]*\bformat\b[^}]*\} from "@\/components\/amount-input"/, file);
  }
});

test("window key handlers leave a key another control already handled", () => {
  for (const name of ["record-key-nav.tsx", "inventory-table.tsx"]) {
    const src = component(name);
    const handler = src.match(/const onKey = \(e: KeyboardEvent\) => \{[\s\S]*?if \(e\.metaKey/)?.[0] ?? "";
    assert.match(handler, /if \(e\.defaultPrevented\) return;/, name);
  }
});

test("the AI suggestions panel survives an answer without its lists", () => {
  const src = component("edit-header.tsx");
  assert.doesNotMatch(src, /suggestions\.(hashtags|materials|techniques|motifs)(?!\s*\?\?)\b(?!\s*\?\?)/);
  assert.match(src, /\(suggestions\.hashtags \?\? \[\]\)\.map/);
  assert.match(src, /\.\.\.\(suggestions\.materials \?\? \[\]\)/);
});

test("the maker profile editor makes Enter start a <p>, once, on mount", () => {
  const src = component("maker-profile-editor.tsx");
  const mount = src.match(/useEffect\(\(\) => \{\n\s+if \(editorRef\.current\) editorRef\.current\.innerHTML = initialHtml;[\s\S]*?\}, \[\]\);/)?.[0] ?? "";
  assert.match(mount, /document\.execCommand\("defaultParagraphSeparator", false, "p"\)/);
});
