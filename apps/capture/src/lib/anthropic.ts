import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.AI_CATALOGUE_MODEL ?? "claude-sonnet-5";

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

/**
 * Run a vision prompt over one or more images and parse a JSON object reply.
 * Returns null if the API is not configured or the reply can't be parsed.
 */
export async function visionJson<T>(opts: {
  system: string;
  instruction: string;
  images: ImageInput[];
  maxTokens?: number;
}): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });

  const content: Block[] = [
    ...opts.images.map(imageBlock),
    { type: "text", text: opts.instruction },
  ];

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseJsonObject<T>(text);
}

/**
 * Run a vision prompt and get a *guaranteed* structured object back via tool
 * use (temperature 0, tool_choice forced). Far more reliable than parsing
 * free-text JSON — the model must fill the given schema, so the result shape is
 * always valid. Returns null only if the API isn't configured or errors.
 */
export async function visionExtract<T>(opts: {
  system: string;
  instruction: string;
  images: ImageInput[];
  schema: Anthropic.Tool.InputSchema;
  toolName?: string;
  maxTokens?: number;
}): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const name = opts.toolName ?? "extract";

  const content: Block[] = [
    ...opts.images.map(imageBlock),
    { type: "text", text: opts.instruction },
  ];

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: 0,
    system: opts.system,
    tools: [
      { name, description: "Record the extracted fields.", input_schema: opts.schema },
    ],
    tool_choice: { type: "tool", name },
    messages: [{ role: "user", content }],
  });

  const block = msg.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === name,
  );
  return (block?.input as T) ?? null;
}

export function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
