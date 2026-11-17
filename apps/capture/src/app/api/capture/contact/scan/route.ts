import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { AiReplyError, fetchImage, visionExtract, isConfigured } from "@/lib/anthropic";
import { text } from "@/lib/capture-values";
import { aiLimitResponse } from "@/lib/ai-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONTACT_TYPES = ["collector", "museum", "dealer", "auction_house", "shipper", "restorer", "press"];

const SYSTEM = `You transcribe a photographed business card or letterhead into contact fields for a gallery CRM.

Rules — accuracy over completeness:
- Transcribe EXACTLY what is printed. Do not guess, translate, expand, or invent anything.
- If a field is not clearly legible or not present on the card, leave it as an empty string "". Never fabricate an email, phone, or address.
- Read the whole card, including small print and both sides of a letterhead. Text may be rotated or in a non-Latin script (Japanese, Chinese) — transcribe what you can and put anything uncertain in notes.
- The card usually names ONE person — put that person in first_name/last_name and their company in organization. If it is a company card with no individual, leave the names empty.
- Normalise: email lower-case; keep phone digits with their international prefix and spacing as printed; strip a leading @ from the Instagram handle.
- notes: capture the job title / role, website, and anything useful that has no dedicated field.
- Pick contact_type from the allowed list as a best guess from the card (a museum/gallery/auction house/shipper/restorer/press outlet is usually obvious); default to "collector" when unclear.`;

const SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    first_name: { type: "string" },
    last_name: { type: "string" },
    organization: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    address_line1: { type: "string" },
    address_line2: { type: "string" },
    city: { type: "string" },
    postcode: { type: "string" },
    country: { type: "string" },
    instagram_handle: { type: "string" },
    contact_type: {
      type: "string",
      enum: CONTACT_TYPES,
    },
    notes: { type: "string" },
  },
  required: [
    "first_name", "last_name", "organization", "email", "phone",
    "address_line1", "address_line2", "city", "postcode", "country",
    "instagram_handle", "contact_type", "notes",
  ],
};

const FIELDS = SCHEMA.required as string[];

export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { path } = (await req.json().catch(() => ({}))) as { path?: unknown };
  if (typeof path !== "string" || !path) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  // Scope to the business-card upload prefix — the client only ever supplies a
  // cards/<uuid>.<ext> path from the upload route; reject anything else so an
  // arbitrary object in the bucket can't be signed and OCR'd.
  if (!/^cards\/[A-Za-z0-9-]+\.[a-z0-9]+$/.test(path))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  const supabase = await getSupabase();
  try {
    return await readCard(gate.session.user.id, supabase, path);
  } finally {
    // The photo of the card is personal data and is not kept: nothing links
    // it to the contact, so erasure or an export could never find it. Once
    // read (or not), it goes, whatever the outcome. The fields the person
    // saves are the record.
    await supabase.storage.from("captures").remove([path]).catch(() => undefined);
  }
}

async function readCard(userId: string, supabase: Awaited<ReturnType<typeof getSupabase>>, path: string) {
  if (!isConfigured()) return NextResponse.json({ configured: false });
  const limited = await aiLimitResponse(userId, "scan");
  if (limited) return limited;

  const { data: signed } = await supabase.storage.from("captures").createSignedUrl(path, 60 * 5);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Could not read image" }, { status: 500 });
  const img = await fetchImage(signed.signedUrl);
  if (!img) return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });

  let card: Record<string, unknown> | null = null;
  try {
    card = await visionExtract({
      system: SYSTEM,
      instruction: "Transcribe the contact details from this card into the tool.",
      images: [img],
      schema: SCHEMA,
      toolName: "contact_card",
      maxTokens: 2048,
    });
  } catch (e) {
    if (!(e instanceof AiReplyError)) console.error("capture card scan:", e instanceof Error ? e.message : e);
    const message = e instanceof AiReplyError ? e.message : "The card could not be read. Try again, or type the details.";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!card) return NextResponse.json({ configured: true, fields: null });

  // The schema is not enforced on the reply: keep known fields, as text.
  const fields: Record<string, string> = {};
  for (const k of FIELDS) {
    const v = text(card[k]);
    if (v) fields[k] = v;
  }
  if (fields.contact_type && !CONTACT_TYPES.includes(fields.contact_type)) delete fields.contact_type;
  return NextResponse.json({ configured: true, fields });
}
