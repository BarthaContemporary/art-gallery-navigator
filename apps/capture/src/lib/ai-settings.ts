/**
 * How the capture app's readings (card scan, label detection, invoice
 * reading) are asked for, by model. Pure (no imports) so `node --test` can
 * load it; lib/anthropic.ts sends the requests.
 *
 * - No sampling parameters (temperature, top_p, top_k): current models
 *   refuse a non-default value with a 400.
 * - Thinking: these are short transcriptions, so it is switched off on the
 *   models that accept `thinking: { type: "disabled" }`. Models that refuse
 *   that (Claude Opus 5.5, Sonnet 5.5, the Fable and Mythos models, and any
 *   model not listed below) keep their default adaptive thinking, which
 *   counts against max_tokens, so they get room for it.
 * - Tool choice: the listed models accept a forced tool, which guarantees
 *   the reply arrives as the tool's input. The others refuse a forced tool,
 *   so they are offered it with tool_choice "auto" and asked to use it.
 */

export type ModelSettings = {
  /** Send thinking: { type: "disabled" }. */
  thinkingOff: boolean;
  /** Send tool_choice: { type: "tool", name }. */
  forceTool: boolean;
};

/**
 * Models known to accept both disabled thinking and a forced tool. A dated
 * snapshot of one (claude-haiku-4-5-20251001) counts as the model.
 */
const ACCEPTS_THINKING_OFF_AND_FORCED_TOOL =
  /^claude-(?:sonnet-5|opus-5|opus-4-[5-8]|sonnet-4-[56]|haiku-4-5|haiku-5-5)(?:-\d{8})?$/;

export function modelSettings(model: string): ModelSettings {
  const known = ACCEPTS_THINKING_OFF_AND_FORCED_TOOL.test(model.trim());
  return { thinkingOff: known, forceTool: known };
}

/** Extra max_tokens for a model that thinks before it answers. */
export const THINKING_ROOM = 12_000;

/** max_tokens for a reply of about `replyTokens`, given the settings. */
export function maxTokensFor(settings: ModelSettings, replyTokens: number): number {
  return settings.thinkingOff ? replyTokens : replyTokens + THINKING_ROOM;
}

/** A model reply that cannot be used; its message is shown to the user. */
export class AiReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiReplyError";
  }
}

/**
 * Why a reply that stopped this way cannot be used, or null when it can.
 * A reply cut off at max_tokens holds half an answer (a truncated JSON
 * object, or a tool input missing fields), and a refusal holds none.
 */
export function stopProblem(stopReason: string | null | undefined): string | null {
  if (stopReason === "max_tokens") return "The reading was cut off before it finished. Try again.";
  if (stopReason === "refusal") return "The model declined to read this photo.";
  return null;
}
