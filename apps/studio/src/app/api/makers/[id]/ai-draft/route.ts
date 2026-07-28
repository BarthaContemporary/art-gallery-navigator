import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabase, getSession } from "@/lib/supabase";
import { sanitizeHtml } from "@/lib/sanitize-html";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Research with web search can take a while — allow a long window on Vercel.
export const maxDuration = 300;

/**
 * AI biography draft for a maker. Feeds everything we know (detail fields,
 * legacy biography, works in stock) to Claude, lets it research the maker via
 * web search, and returns a brief biographic profile as an HTML fragment the
 * rich-text editor can take over as an editable draft.
 *
 * The writing instructions deliberately "humanize" the output: natural,
 * varied prose without the usual AI tells, concrete facts only, uncertainty
 * flagged instead of papered over. The draft is never saved directly — it
 * lands in the editor and goes through the normal sanitise-on-save path.
 */

const WRITING_SYSTEM = `You are writing maker biographies for Joost van den Bergh, a London dealer in Japanese and Indian works of art. Your drafts appear on the gallery's website and in printed profiles, so they must read as if written by a knowledgeable human specialist, not by an AI.

RESEARCH RULES
- Use web search to research the maker. Prefer museum collections (V&A, Met, Tokyo National Museum, Khalili), auction records, academic sources and gallery literature over aggregator sites.
- Never invent facts, dates, exhibitions, honours or collections. If the record is thin, write a shorter text — a credible 120-word biography beats a padded 300-word one.
- If sources disagree or something is unverified, say so naturally in the text ("sources differ on…", "is thought to have…").
- If you cannot find reliable information beyond what was provided, say exactly that in one honest paragraph rather than speculating.
- Distinguish carefully between makers with similar names; anchor on the native name, life dates, region and school/workshop provided.

WRITING RULES (make it sound human)
- Brief: two to four paragraphs, roughly 120–280 words. Open with the maker and what they are known for; cover training/school, materials and techniques, honours or notable collections if verifiable; close on their significance or the character of their work.
- Vary sentence length and rhythm. Mix short declarative sentences with longer ones. Never start consecutive sentences the same way.
- Concrete over abstract: name actual techniques, materials, teachers, exhibitions. Cut every sentence that could describe any artist.
- Forbidden: "renowned", "masterful", "testament to", "stands as", "rich cultural heritage", "delve", "showcasing", "boasts", "vibrant", "seamlessly", "intricate craftsmanship" used generically, rhetorical questions, bullet lists, headings, and any concluding sentence that begins "Overall" or "In conclusion".
- No hype. The connoisseurship register is quiet and precise: understatement, specifics, and the occasional dry observation carry more authority than superlatives.
- Use the macron romanization the gallery uses (e.g. Shōmin, jōmon) and give the native script once where natural.

OUTPUT FORMAT
Return ONLY an HTML fragment — no markdown, no code fences, no commentary before or after. Allowed tags: <p>, <b>, <i>. Each paragraph in its own <p>. Use <i> for work titles and non-English terms on first use. Do not include the maker's name as a heading (the page already shows it). Do not include citations, footnote markers or URLs in the text.`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return NextResponse.json(
      { error: "AI is not configured on this deployment (ANTHROPIC_API_KEY missing)." },
      { status: 503 },
    );

  const supabase = await getSupabase();
  const { data: maker } = await supabase
    .from("makers")
    .select(
      "id, display_name, native_name, romanized_name, alt_names, life_dates, region, school_or_workshop, biography",
    )
    .eq("id", id)
    .maybeSingle();
  if (!maker) return NextResponse.json({ error: "Maker not found" }, { status: 404 });

  // Works in stock give strong hints about the maker's materials and subjects.
  const { data: works } = await supabase
    // Both registers: who made a work is independent of who owns it.
    .from("vw_pieces_list")
    .select("title, medium, period, category_name")
    .eq("maker_id", id)
    .limit(25);

  const facts: string[] = [];
  facts.push(`Name (romanized): ${maker.display_name}`);
  if (maker.native_name) facts.push(`Native name: ${maker.native_name}`);
  if (maker.romanized_name) facts.push(`Romanized variant: ${maker.romanized_name}`);
  const alts = (maker.alt_names as string[] | null) ?? [];
  if (alts.length) facts.push(`Also recorded as: ${alts.join(", ")}`);
  if (maker.life_dates) facts.push(`Life dates: ${maker.life_dates}`);
  if (maker.region) facts.push(`Region: ${maker.region}`);
  if (maker.school_or_workshop) facts.push(`School / workshop: ${maker.school_or_workshop}`);
  if (maker.biography)
    facts.push(`Existing gallery notes (may be rough, verify before reusing):\n${maker.biography}`);

  const workLines = (works ?? [])
    .map((w) => {
      return [w.title, w.category_name, w.medium, w.period].filter(Boolean).join(" — ");
    })
    .filter((l) => l.length > 0);
  if (workLines.length)
    facts.push(`Works by this maker handled by the gallery:\n- ${workLines.join("\n- ")}`);

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.AI_BIOGRAPHY_MODEL ?? "claude-opus-4-8";

  let html = "";
  const sources: { url: string; title: string }[] = [];
  try {
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: WRITING_SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages: [
        {
          role: "user",
          content: `Research this maker and write the biography draft.\n\n${facts.join("\n")}`,
        },
      ],
    });
    const msg = await stream.finalMessage();

    for (const block of msg.content) {
      if (block.type === "text") {
        html += block.text;
        for (const c of block.citations ?? []) {
          if (c.type === "web_search_result_location" && !sources.some((s) => s.url === c.url))
            sources.push({ url: c.url, title: c.title ?? c.url });
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  html = html
    .replace(/^```(?:html)?/i, "")
    .replace(/```$/i, "")
    .trim();
  if (!html) return NextResponse.json({ error: "The model returned no draft" }, { status: 502 });
  // Plain-text fallback: wrap loose prose in paragraphs.
  if (!/^</.test(html))
    html = html
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p.trim())}</p>`)
      .join("");

  // Defence in depth: the model read arbitrary web pages, and the client
  // inserts this straight into the editor via innerHTML — never return it
  // unsanitised (the save path sanitises again).
  html = sanitizeHtml(html);

  return NextResponse.json({ html, sources, model });
}
