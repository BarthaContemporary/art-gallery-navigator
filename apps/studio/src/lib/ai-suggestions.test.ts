// node --test apps/studio/src/lib/ai-suggestions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { modelImageType, normaliseSuggestions, parseSuggestions, stopProblem } from "./ai-suggestions.ts";

const full = {
  hashtags: ["#okimono", "bronze", "#okimono"],
  object_type: "okimono",
  materials: ["bronze", "silver inlay"],
  techniques: ["lost-wax casting"],
  motifs: ["dragon"],
  suggested_category: "Metalwork",
  suggested_medium: "Bronze with silver inlay",
  suggested_period: "Meiji (1868-1912)",
  description_draft: "A dragon, apparently cast in one piece.",
};

test("a well-formed answer comes through, tags '#'-style and de-duplicated", () => {
  const s = normaliseSuggestions(full)!;
  assert.deepEqual(s.hashtags, ["#okimono", "#bronze"]);
  assert.deepEqual(s.materials, ["bronze", "silver inlay"]);
  assert.equal(s.description_draft, full.description_draft);
});

test("missing, null or wrongly typed fields become [] and ''", () => {
  const s = normaliseSuggestions({ hashtags: null, motifs: "dragon", materials: [1, "bronze", null, ""], object_type: 7 })!;
  assert.deepEqual(s.hashtags, []);
  assert.deepEqual(s.motifs, []);
  assert.deepEqual(s.materials, ["bronze"]);
  assert.deepEqual(s.techniques, []);
  assert.equal(s.object_type, "");
  assert.equal(s.suggested_period, "");
  // Unknown keys are dropped.
  assert.equal("extra" in (normaliseSuggestions({ extra: "x" }) as object), false);
});

test("an answer that is not an object is no answer", () => {
  for (const raw of [null, undefined, "text", 3, ["a"], true]) assert.equal(normaliseSuggestions(raw), null, String(raw));
});

test("parseSuggestions finds the object in fenced or wrapped text, and refuses a cut-off one", () => {
  assert.deepEqual(parseSuggestions("```json\n" + JSON.stringify(full) + "\n```")?.object_type, "okimono");
  assert.equal(parseSuggestions("Here it is: " + JSON.stringify(full))?.motifs[0], "dragon");
  // Cut off at the token cap: no closing brace.
  assert.equal(parseSuggestions(JSON.stringify(full).slice(0, 80)), null);
  assert.equal(parseSuggestions("no json here"), null);
});

test("only the image types the model reads are sent", () => {
  assert.equal(modelImageType("image/jpeg"), "image/jpeg");
  assert.equal(modelImageType("image/webp; charset=binary"), "image/webp");
  assert.equal(modelImageType("IMAGE/PNG"), "image/png");
  for (const t of ["application/json", "text/html", "image/tiff", "image/heic", "", null]) assert.equal(modelImageType(t), null, String(t));
});

test("a cut-off or refused turn is reported, not parsed", () => {
  assert.match(stopProblem("max_tokens") ?? "", /cut short/);
  assert.match(stopProblem("refusal") ?? "", /declined/);
  for (const r of ["end_turn", "stop_sequence", null, undefined]) assert.equal(stopProblem(r), null, String(r));
});
