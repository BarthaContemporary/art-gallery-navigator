import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend event webhook — records opens / clicks / bounces for newsletter
 * campaign recipients (and offer recipients) so the studio tracking views
 * reflect real engagement.
 *
 * Security: fails CLOSED — RESEND_WEBHOOK_SECRET must be set and the request
 * must carry a matching `?secret=` param (constant-time compared). This route
 * writes with the service client (bypasses RLS), so it must never be open.
 */

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; bounce?: { type?: string }; created_at?: string } & Record<string, unknown>;
  created_at?: string;
};

const FIELD_BY_TYPE: Record<string, "opened_at" | "clicked_at" | "bounced_at"> = {
  "email.opened": "opened_at",
  "email.clicked": "clicked_at",
  "email.bounced": "bounced_at",
  "email.complained": "bounced_at",
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !safeEqual(req.nextUrl.searchParams.get("secret"), secret)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = (await req.json()) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  const type = event.type ?? "";
  if (!emailId) return NextResponse.json({ ok: true, ignored: "no email_id" });

  const supabase = createServiceClient();
  const at = event.created_at ?? new Date().toISOString();
  const field = FIELD_BY_TYPE[type];

  // Update the matching campaign recipient (if any).
  const { data: rec } = await supabase
    .from("crm_campaign_recipients")
    .select("id")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  const recipientId = (rec as { id: string } | null)?.id ?? null;

  // A spam complaint is a withdrawal of consent (PECR reg. 22); a permanent
  // bounce means the address is dead. Both stop further marketing to the
  // contact, whichever campaign or offer the email belonged to.
  if (type === "email.complained" || type === "email.bounced") {
    const transient = type === "email.bounced" && /transient|soft/i.test(event.data?.bounce?.type ?? "");
    if (!transient) {
      const contactId = await contactForEmail(supabase, emailId, recipientId);
      if (contactId) {
        await supabase
          .from("crm_contacts")
          .update(
            type === "email.complained"
              ? { marketing_consent: false, unsubscribed_at: at, do_not_mail: true }
              : { email_bounced_at: at, do_not_mail: true },
          )
          .eq("id", contactId);
      }
    }
  }

  if (recipientId && field) {
    const patch: Record<string, unknown> = { [field]: at };
    if (field === "bounced_at") patch.status = "bounced";
    else if (type === "email.opened") patch.status = "opened";
    else if (type === "email.clicked") patch.status = "clicked";
    await supabase.from("crm_campaign_recipients").update(patch).eq("id", recipientId);
  }

  // Also surface offer email opens (offer_recipients tracks the same ids).
  if (type === "email.opened") {
    const { data: orec } = await supabase
      .from("offer_recipients")
      .select("id, first_viewed_at, view_count")
      .eq("resend_email_id", emailId)
      .maybeSingle();
    const o = orec as
      | { id: string; first_viewed_at: string | null; view_count: number }
      | null;
    if (o) {
      await supabase
        .from("offer_recipients")
        .update({
          first_viewed_at: o.first_viewed_at ?? at,
          last_viewed_at: at,
          view_count: (o.view_count ?? 0) + 1,
        })
        .eq("id", o.id);
    }
  }

  // Always record the raw event for the audit trail.
  await supabase.from("email_events").insert({
    event_type: type || "unknown",
    campaign_recipient_id: recipientId,
    payload: event as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}

/** The contact behind a Resend email id, via the campaign or offer recipient row. */
async function contactForEmail(
  supabase: ReturnType<typeof createServiceClient>,
  emailId: string,
  recipientId: string | null,
): Promise<string | null> {
  if (recipientId) {
    const { data } = await supabase.from("crm_campaign_recipients").select("contact_id").eq("id", recipientId).maybeSingle();
    if (data?.contact_id) return data.contact_id as string;
  }
  const { data } = await supabase.from("offer_recipients").select("contact_id").eq("resend_email_id", emailId).maybeSingle();
  return (data?.contact_id as string | undefined) ?? null;
}
