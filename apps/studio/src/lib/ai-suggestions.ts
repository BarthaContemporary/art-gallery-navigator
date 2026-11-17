/*
 * The cataloguing suggestions the Analyse image route asks the model for
 * (app/api/ai/analyse/route.ts), read defensively: the answer is model
 * output, so its shape is checked, never cast. Lists become lists of
 * non-empty strings, text fields strings, anything else is dropped. The
 * editor maps and spreads the lists, so a missing or null list must arrive
 * as []. Pure; tested in ai-suggestions.test.ts.
 */

export type Suggestions = {
  hashtags: string[];
  object_type: string;
  materials: string[];
  techniques: string[];
  motifs: string[];
  suggested_category: string;
  suggested_medium: string;
  suggested_period: string;
  description_draft: string;
};

const LIST_MAX = 30;
const TEXT_MAX = 4000;

const text = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, TEXT_MAX) : "");
const list = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, LIST_MAX)
    : [];

/** The suggestions in their checked shape, or null when the answer is not an object. */
export function normaliseSuggestions(raw: unknown): Suggestions | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    // "#"-style tags, as the accept-tags step expects.
    hashtags: [...new Set(list(r.hashtags).map((t) => (t.startsWith("#") ? t : `#${t}`)))],
    object_type: text(r.object_type),
    materials: list(r.materials),
    techniques: list(r.techniques),
    motifs: list(r.motifs),
    suggested_category: text(r.suggested_category),
    suggested_medium: text(r.suggested_medium),
    suggested_period: text(r.suggested_period),
    description_draft: text(r.description_draft),
  };
}

/** The JSON object in the model's text (code fences and stray prose around it tolerated), checked. */
export function parseSuggestions(answer: string): Suggestions | null {
  const cleaned = answer
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return normaliseSuggestions(JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return null;
  }
}

/** Image types the Messages API takes. */
export const MODEL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export type ModelImageType = (typeof MODEL_IMAGE_TYPES)[number];

/** The response's image type, if the model can read it. */
export function modelImageType(contentType: string | null): ModelImageType | null {
  const t = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
  return (MODEL_IMAGE_TYPES as readonly string[]).includes(t) ? (t as ModelImageType) : null;
}

/**
 * Why a finished turn is not an answer to parse, in the words the editor
 * shows, or null when it is. A cut-off answer (max_tokens) has no closing
 * brace and would otherwise surface as "Could not parse suggestions".
 */
export function stopProblem(stopReason: string | null | undefined): string | null {
  if (stopReason === "max_tokens") return "The analysis was cut short before it finished. Try again.";
  if (stopReason === "refusal") return "The model declined to analyse this image.";
  return null;
}
