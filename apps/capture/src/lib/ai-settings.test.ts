// node --test apps/capture/src/lib/ai-settings.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
// node --test needs the extension; the app's tsconfig does not allow it.
// @ts-ignore
import { AiReplyError, maxTokensFor, modelSettings, stopProblem, THINKING_ROOM } from "./ai-settings.ts";

test("the default model is read with thinking off and a forced tool", () => {
  for (const m of [
    "claude-sonnet-5",
    "claude-opus-5",
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-haiku-4-5-20251001",
    "claude-haiku-5-5",
  ]) {
    assert.deepEqual(modelSettings(m), { thinkingOff: true, forceTool: true }, m);
  }
});

test("models that refuse disabled thinking or a forced tool get neither", () => {
  for (const m of [
    "claude-sonnet-5-5",
    "claude-opus-5-5",
    "claude-fable-5-2",
    "claude-mythos-5-2",
    "claude-sonnet-5-5-20260901",
    "some-future-model",
    "",
  ]) {
    assert.deepEqual(modelSettings(m), { thinkingOff: false, forceTool: false }, m);
  }
});

test("a thinking model gets room to think within max_tokens", () => {
  assert.equal(maxTokensFor(modelSettings("claude-sonnet-5"), 2048), 2048);
  assert.equal(maxTokensFor(modelSettings("claude-opus-5-5"), 2048), 2048 + THINKING_ROOM);
  // Stays a non-streaming size.
  assert.ok(maxTokensFor(modelSettings("claude-opus-5-5"), 4096) <= 16_384);
});

test("a cut-off or refused reply is a problem; a finished one is not", () => {
  assert.match(stopProblem("max_tokens") ?? "", /cut off/);
  assert.match(stopProblem("refusal") ?? "", /declined/);
  for (const s of ["end_turn", "tool_use", "stop_sequence", null, undefined]) assert.equal(stopProblem(s), null);
  const e = new AiReplyError("x");
  assert.ok(e instanceof Error);
  assert.equal(e.name, "AiReplyError");
});
