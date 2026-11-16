import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { planResendEvent, type ResendEvent } from "@/lib/resend-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resend event webhook — records opens / clicks / bounces for newsletter
 * campaign recipients, and suppresses contacts after a spam complaint or a
 * permanent bounce (campaign or offer email alike).
 *
 * Security: fails CLOSED — RESEND_WEBHOOK_SECRET must be set and the request
 * must carry a matching `?secret=` param (constant-time compared). This route
 * writes with the service client (bypasses RLS), so it must never be open.
 *
 * Delivery: Resend (Svix) redelivers an event for hours when the answer is
 * not 2xx. So a failed read or write answers 500 and the event comes back;
 * an email nobody tracks (a booking confirmation, a test send) matches no
 * row, which is not an error and answers 200. Every write is safe to repeat:
 * the times come from the event itself, and the audit row is written last.
 *
 * An email open is not an offer page view: opens are not written to
 * offer_recipients' view columns, which count real visits to the page
 * (app/o/[token]); the open is kept on the audit row, linked to the offer
 * recipient.
 */

type DbError = { code?: string | null; message?: string | null };

/** Log the step and PostgREST's code and message (no addresses), and ask Resend to retry. */
function retryLater(step: string, error: DbError | unknown) {
  const e = error as DbError | null;
  console.error(`[resend-webhook] ${step} failed:`, e?.code ?? null, e?.message ?? String(error));
  return NextResponse.json({ error: "temporarily unavailable" }, { status: 500 });
}

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

  const plan = planResendEvent(event);

  try {
    const supabase = createServiceClient();

    // The campaign recipient the email went to, if any. limit(1): the column
    // has no unique index, and a duplicate must not turn into endless retries.
    const { data: rec, error: recError } = await supabase
      .from("crm_campaign_recipients")
      .select("id, contact_id")
      .eq("resend_email_id", emailId)
      .limit(1)
      .maybeSingle();
    if (recError) return retryLater("campaign recipient lookup", recError);
    const campaignRecipient = rec as { id: string; contact_id: string | null } | null;

    // Otherwise the offer recipient (offer emails carry their own ids).
    let offerRecipient: { id: string; contact_id: string | null } | null = null;
    if (!campaignRecipient) {
      const { data: orec, error: orecError } = await supabase
        .from("offer_recipients")
        .select("id, contact_id")
        .eq("resend_email_id", emailId)
        .limit(1)
        .maybeSingle();
      if (orecError) return retryLater("offer recipient lookup", orecError);
      offerRecipient = orec as { id: string; contact_id: string | null } | null;
    }

    if (plan.suppression) {
      const contactId = campaignRecipient?.contact_id ?? offerRecipient?.contact_id ?? null;
      if (contactId) {
        const { data: updated, error: updError } = await supabase
          .from("crm_contacts")
          .update(plan.suppression)
          .eq("id", contactId)
          .select("id");
        if (updError) return retryLater("contact suppression", updError);
        // Erased between the lookup and the update: nothing left to suppress,
        // and a retry would never find it either.
        if (!updated || (updated as unknown[]).length === 0) {
          console.warn("[resend-webhook] contact suppression matched no row");
        }
      }
    }

    if (campaignRecipient && plan.recipientPatch) {
      const { error: patchError } = await supabase
        .from("crm_campaign_recipients")
        .update(plan.recipientPatch)
        .eq("id", campaignRecipient.id);
      if (patchError) return retryLater("campaign recipient update", patchError);
    }

    // Always record the raw event for the audit trail (last, so a retry
    // after an earlier failure does not leave a second row).
    const { error: auditError } = await supabase.from("email_events").insert({
      event_type: type || "unknown",
      campaign_recipient_id: campaignRecipient?.id ?? null,
      offer_recipient_id: offerRecipient?.id ?? null,
      payload: event as unknown as Record<string, unknown>,
    });
    if (auditError) return retryLater("audit insert", auditError);
  } catch (error) {
    return retryLater("event handling", error);
  }

  return NextResponse.json({ ok: true });
}
