import { NextResponse } from "next/server";
import { getSupabase, requireCapture } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_TYPES = ["collector", "museum", "dealer", "auction_house", "shipper", "restorer", "press"];

/** Create a CRM contact immediately from the capture app. */
export async function POST(req: Request) {
  const gate = await requireCapture();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const s = (k: string) => {
    const v = String(b[k] ?? "").trim();
    return v || null;
  };
  const contactType = String(b.contact_type ?? "collector");
  const org = s("organization");

  const notes = [s("notes"), org ? `Organisation: ${org}` : null].filter(Boolean).join("\n") || null;

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      first_name: s("first_name"),
      last_name: s("last_name"),
      email: s("email"),
      phone: s("phone"),
      address_line1: s("address_line1"),
      address_line2: s("address_line2"),
      city: s("city"),
      postcode: s("postcode"),
      country: s("country"),
      instagram_handle: s("instagram_handle"),
      contact_type: CONTACT_TYPES.includes(contactType) ? contactType : "collector",
      custom_fields: org ? { organization: org } : {},
      tags: ["capture"],
      consent_source: "capture_app",
      notes,
    })
    .select("id, first_name, last_name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
