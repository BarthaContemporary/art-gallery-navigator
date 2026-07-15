import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@jvb/db/server";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const responseSchema = z.object({
  token: z.string().min(8).max(200),
  response: z.enum(["interested", "declined"]).default("interested"),
  message: z.string().trim().max(2000).optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let payload: z.infer<typeof responseSchema>;
  try {
    const parsed = responseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const turnstile = await verifyTurnstile(
    payload.turnstileToken,
    req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for"),
  );
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstile.error ?? "Verification failed" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("offer_recipients")
      .select("id, contact_id, offer:offers ( id, title )")
      .eq("token", payload.token)
      .maybeSingle();

    const recipient = data as unknown as {
      id: string;
      contact_id: string | null;
      offer: { id: string; title: string | null } | null;
    } | null;

    if (!recipient) {
      return NextResponse.json({ error: "Unknown token" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("offer_recipients")
      .update({ response: payload.response, responded_at: new Date().toISOString() })
      .eq("id", recipient.id);
    if (updateError) throw updateError;

    if (payload.response === "interested") {
      // Best-effort enquiry record — staff notification surface in the studio.
      const { error: enquiryError } = await supabase.from("enquiries").insert({
        contact_id: recipient.contact_id,
        channel: "offer",
        message:
          payload.message ??
          `Interested in offer "${recipient.offer?.title ?? recipient.offer?.id ?? "unknown"}".`,
      });
      if (enquiryError) {
        console.error("[offer-response] enquiry insert failed:", enquiryError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[offer-response] failed:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
