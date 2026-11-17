import { NextResponse } from "next/server";
import { getSession, getSupabase } from "@/lib/supabase";
import { contactPickerSearch } from "@/lib/contact-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The contact pickers' search (components/use-contact-search.ts: the buyer
 * picker and the consignment panel): { results: [{ id, name, email }] },
 * best first. The session and its roles are read once, here; admin and staff
 * only (the accountant has no CRM access). Ranked by searchContactIds, rows
 * from crm_contacts through the user's own client (lib/contact-search.ts).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q");
  const supabase = await getSupabase();
  const { status, body } = await contactPickerSearch(supabase, q, session.roles);
  return NextResponse.json(body, { status });
}
