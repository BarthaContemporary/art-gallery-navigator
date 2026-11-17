import Anthropic from "@anthropic-ai/sdk";
import { AiReplyError, maxTokensFor, modelSettings, stopProblem } from "@/lib/ai-settings";

/**
 * The model for the card scan, label detection and invoice reading. Any
 * current model works (lib/ai-settings.ts adapts the request to it); the
 * listed ones there are read with thinking off and a forced tool.
 */
export const MODEL = process.env.AI_CATALOGUE_MODEL?.trim() || "claude-sonnet-5";

export { AiReplyError };

export type ImageInput = { base64: string; mediaType: string };

/** Download a signed-URL image and return base64 + media type for Claude. */
export async function fetchImage(url: string): Promise<ImageInput | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type");
    const mediaType =
      ct && ct.startsWith("image/") ? ct.split(";")[0]! : "image/jpeg";
    return { base64: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

type Block = Anthropic.ImageBlockParam | Anthropic.TextBlockParam;

function imageBlock(img: ImageInput): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: img.mediaType as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp",
      data: img.base64,
    },
  };
}

/** Pull the first {...} JSON object out of a model reply. */
export function parseJsonObject<T>(text: string): T | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** The request settings every reading shares, for the configured model. */
function readingParams(replyTokens: number) {
  const settings = modelSettings(MODEL);
  return {
    settings,
    params: {
      model: MODEL,
      max_tokens: maxTokensFor(settings, replyTokens),
      ...(settings.thinkingOff ? { thinking: { type: "disabled" as const } } : {}),
    },
  };
}

/** Throws AiReplyError when the reply was cut off or refused. */
function checkStop(msg: Anthropic.Message) {
  const problem = stopProblem(msg.stop_reason);
  if (problem) throw new AiReplyError(problem);
}

/**
 * Run a vision prompt over one or more images and parse a JSON object reply.
 * Returns null if the API is not configured or the reply holds no JSON
 * object; throws AiReplyError if the reply was cut off or refused, and the
 * SDK's errors if the request failed. The reply is untyped model output:
 * callers check every field (lib/capture-values.ts) before using it.
 */
export async function visionJson(opts: {
  system: string;
  instruction: string;
  images: ImageInput[];
  maxTokens?: number;
}): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const content: Block[] = [
    ...opts.images.map(imageBlock),
    { type: "text", text: opts.instruction },
  ];

  const { params } = readingParams(opts.maxTokens ?? 2048);
  const msg = await anthropic.messages.create({
    ...params,
    system: opts.system,
    messages: [{ role: "user", content }],
  });
  checkStop(msg);

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseJsonObject<unknown>(text);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/**
 * Run a vision prompt and get the reading back as a tool's input. On the
 * models that allow it the tool is forced; on the others it is offered and
 * the instruction asks for it. Returns null if the API isn't configured or
 * the model answered without the tool; throws AiReplyError if the reply was
 * cut off or refused. The schema is not enforced on the reply (no strict
 * mode in this SDK), so callers still check every field.
 */
export async function visionExtract(opts: {
  system: string;
  instruction: string;
  images: ImageInput[];
  schema: Anthropic.Tool.InputSchema;
  toolName?: string;
  maxTokens?: number;
}): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const name = opts.toolName ?? "extract";
  const { settings, params } = readingParams(opts.maxTokens ?? 2048);

  const content: Block[] = [
    ...opts.images.map(imageBlock),
    {
      type: "text",
      text: settings.forceTool
        ? opts.instruction
        : `${opts.instruction} Give your answer only by calling the ${name} tool.`,
    },
  ];

  const msg = await anthropic.messages.create({
    ...params,
    system: opts.system,
    tools: [
      { name, description: "Record the extracted fields.", input_schema: opts.schema },
    ],
    tool_choice: settings.forceTool ? { type: "tool", name } : { type: "auto" },
    messages: [{ role: "user", content }],
  });
  checkStop(msg);

  const block = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === name,
  );
  const input = block?.input;
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
