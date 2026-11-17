// node --test apps/studio/src/lib/ai-draft.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore TS5097
import { answerText, draftHtml, draftSources, draftStopProblem, escapeHtml } from "./ai-draft.ts";

const bio = "<p>Unno Shōmin trained under <i>Kanō Natsuo</i>.</p><p>His work is in the Khalili collection.</p>";

test("a preamble before the searches is not part of the draft", () => {
  const blocks = [
    { type: "thinking", text: "" },
    { type: "text", text: "I'll check the museum records first." },
    { type: "server_tool_use" },
    { type: "web_search_tool_result" },
    { type: "text", text: "Let me look once more." },
    { type: "server_tool_use" },
    { type: "web_search_tool_result" },
    { type: "text", text: bio.slice(0, 40) },
    { type: "text", text: bio.slice(40) },
  ];
  assert.equal(answerText(blocks), bio);
  assert.equal(draftHtml(answerText(blocks)), bio);
});

test("other tool blocks (code execution of the filtering search) also end the preamble", () => {
  const blocks = [
    { type: "text", text: "Searching." },
    { type: "bash_code_execution_tool_result" },
    { type: "text", text: bio },
  ];
  assert.equal(answerText(blocks), bio);
});

test("text around the fragment is cut away; tags are never escaped", () => {
  assert.equal(draftHtml(`Here is the draft:\n\n${bio}\n\nI hope this helps.`), bio);
  assert.equal(draftHtml("```html\n" + bio + "\n```"), bio);
  const html = draftHtml(`Note first. ${bio}`);
  assert.doesNotMatch(html, /&lt;p&gt;/);
});

test("loose prose is escaped into paragraphs; tags without <p> get paragraphs as they are", () => {
  assert.equal(draftHtml("One & two.\n\nThree <maybe"), "<p>One &amp; two.</p><p>Three &lt;maybe</p>");
  assert.equal(draftHtml("Made in <i>Meiji</i>.\n\nSecond."), "<p>Made in <i>Meiji</i>.</p><p>Second.</p>");
  assert.equal(draftHtml("   "), "");
  assert.equal(escapeHtml("<a&b>"), "&lt;a&amp;b&gt;");
});

test("a cut-off, refused or still-paused turn is not a draft", () => {
  assert.match(draftStopProblem("max_tokens") ?? "", /ran out of room/);
  assert.match(draftStopProblem("refusal") ?? "", /declined/);
  assert.match(draftStopProblem("pause_turn") ?? "", /too long/);
  assert.equal(draftStopProblem("end_turn"), null);
  assert.equal(draftStopProblem(null), null);
});

test("sources: web citations from any text block, http(s) only, once each", () => {
  const blocks = [
    { type: "text", text: "pre", citations: [{ type: "web_search_result_location", url: "https://www.vam.ac.uk/x", title: "V&A" }] },
    { type: "server_tool_use" },
    {
      type: "text",
      text: bio,
      citations: [
        { type: "web_search_result_location", url: "https://www.vam.ac.uk/x", title: "V&A again" },
        { type: "web_search_result_location", url: "javascript:alert(1)", title: "bad" },
        { type: "char_location", url: "https://elsewhere.example", title: "not web" },
        { type: "web_search_result_location", url: "http://collection.example/y", title: null },
      ],
    },
  ];
  assert.deepEqual(draftSources(blocks), [
    { url: "https://www.vam.ac.uk/x", title: "V&A" },
    { url: "http://collection.example/y", title: "http://collection.example/y" },
  ]);
});
