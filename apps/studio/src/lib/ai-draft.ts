/*
 * Turning the AI biography turn (app/api/makers/[id]/ai-draft/route.ts) into
 * the draft fragment and its sources. Pure; tested in ai-draft.test.ts.
 *
 * With the web search tool the answer is one message holding everything the
 * model wrote, including any sentence before or between its searches ("I'll
 * check the museum records first."), ahead of the biography itself. So the
 * draft is the text after the last block that is neither text nor thinking
 * (a search call or result, a filtering step), and within it the run from
 * the first <p to the last </p>. Only text with no tag at all is treated as
 * loose prose and escaped into paragraphs; text with tags but no <p> is put
 * in paragraphs as it is (the route sanitises whatever comes out, and the
 * profile save sanitises it again).
 */

/** The part of a content block this reads (the SDK's blocks carry more). */
export type DraftBlock = {
  type: string;
  text?: string;
  citations?: readonly { type: string; url?: string; title?: string | null }[] | null;
};

export type DraftSource = { url: string; title: string };

const NOT_ANSWER = new Set(["text", "thinking", "redacted_thinking"]);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Web pages cited anywhere in the turn, http(s) only, each once. */
export function draftSources(blocks: readonly DraftBlock[]): DraftSource[] {
  const out: DraftSource[] = [];
  for (const b of blocks) {
    if (b.type !== "text") continue;
    for (const c of b.citations ?? []) {
      if (c.type !== "web_search_result_location" || !c.url || !/^https?:\/\//i.test(c.url)) continue;
      if (!out.some((s) => s.url === c.url)) out.push({ url: c.url, title: c.title || c.url });
    }
  }
  return out;
}

/** The answer's text: the text blocks after the last search or tool block. */
export function answerText(blocks: readonly DraftBlock[]): string {
  let last = -1;
  blocks.forEach((b, i) => {
    if (!NOT_ANSWER.has(b.type)) last = i;
  });
  return blocks
    .slice(last + 1)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

/** The answer as an HTML fragment (not yet sanitised), or "" when there is none. */
export function draftHtml(answer: string): string {
  let html = answer
    .replace(/^\s*```(?:html)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!html) return "";
  const firstP = html.search(/<p[\s>]/i);
  if (firstP !== -1) {
    const lastClose = html.toLowerCase().lastIndexOf("</p>");
    html = html.slice(firstP, lastClose > firstP ? lastClose + 4 : html.length).trim();
    return html;
  }
  const paragraphs = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Tags but no paragraphs (<i>, <b>): keep them, add the paragraphs.
  if (/<\/?[a-z][^>]*>/i.test(html)) return paragraphs.map((p) => `<p>${p}</p>`).join("");
  // Loose prose: escaped, in paragraphs.
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

/**
 * Why a finished turn gives no draft, in the words the editor shows, or null
 * when it does. A turn cut at max_tokens may end mid-sentence and still look
 * like a draft, so it is never offered as one.
 */
export function draftStopProblem(stopReason: string | null | undefined): string | null {
  if (stopReason === "max_tokens") return "The research ran out of room before the draft was finished. Try again.";
  if (stopReason === "refusal") return "The model declined to write this draft.";
  if (stopReason === "pause_turn") return "The research took too long to finish. Try again later.";
  return null;
}
