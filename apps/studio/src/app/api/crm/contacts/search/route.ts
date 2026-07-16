import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Trigram-fuzzy search (tolerates typos / partial names).
  const { data, error } = await supabase
    .rpc("crm_contacts_search", { q })
    .select("id, first_name, last_name, email")
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>;
  const results = rows.map((c) => ({
    id: c.id,
    name:
      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.email ||
      "Unnamed",
    email: c.email ?? null,
  }));

  return NextResponse.json({ results });
}
