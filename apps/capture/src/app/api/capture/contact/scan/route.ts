import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";
import { fetchImage, visionJson, isConfigured } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You read a photographed business card or letterhead and extract contact details for a gallery CRM.

Return ONLY a JSON object (no prose, no code fences):
{
  "first_name": string,
  "last_name": string,
  "organization": string,
  "email": string,
  "phone": string,
  "address_line1": string,
  "address_line2": string,
  "city": string,
  "postcode": string,
  "country": string,
  "instagram_handle": string,
  "contact_type": string,        // one of: collector, museum, dealer, auction_house, shipper, restorer, press — best guess, else "collector"
  "notes": string                // anything useful not captured above (title/role, website), else ""
}
Transcribe exactly what is printed. Use "" for anything not present. Split a full name into first/last as best you can.`;

type Card = Record<string, string>;

export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!isConfigured()) return NextResponse.json({ configured: false });

  const { path } = (await req.json().catch(() => ({}))) as { path?: string };
  if (!path) return NextResponse.json({ error: "Missing path" }, { status: 400 });

  const supabase = await getSupabase();
  const { data: signed } = await supabase.storage.from("captures").createSignedUrl(path, 60 * 5);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Could not read image" }, { status: 500 });
  const img = await fetchImage(signed.signedUrl);
  if (!img) return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });

  let card: Card | null = null;
  try {
    card = await visionJson<Card>({
      system: SYSTEM,
      instruction: "Extract the contact details from this card.",
      images: [img],
      maxTokens: 800,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
  if (!card) return NextResponse.json({ configured: true, fields: null });
  return NextResponse.json({ configured: true, fields: card });
}
