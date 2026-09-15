import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@jvb/db/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email address").max(320),
  website: z.string().optional(), // honeypot
});

/**
 * Footer newsletter sign-up → CRM contact with marketing consent. An existing
 * contact (matched on email) is re-consented and un-unsubscribed; a new one is
 * created. Nothing is emailed from here — campaigns are sent from the studio.
 */
export async function POST(req: NextRequest) {
  let payload: z.infer<typeof schema>;
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (payload.website) return NextResponse.json({ ok: true }); // bot: pretend

  const email = payload.email.toLowerCase();
  const [firstName, ...rest] = payload.name.split(/\s+/);
  const lastName = rest.join(" ") || null;
  const now = new Date().toISOString();

  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("crm_contacts")
        .update({
          marketing_consent: true,
          consent_date: now,
          consent_source: "website_newsletter",
          unsubscribed_at: null,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("crm_contacts").insert({
        first_name: firstName,
        last_name: lastName,
        email,
        marketing_consent: true,
        consent_date: now,
        consent_source: "website_newsletter",
        tags: ["newsletter"],
      });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsletter] failed:", err);
    return NextResponse.json({ error: "Could not sign you up right now — please try again." }, { status: 500 });
  }
}
