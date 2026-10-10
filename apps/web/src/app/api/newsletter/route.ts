import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@jvb/db/server";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName, siteUrl } from "@/lib/site";
import { consentEvidence, mergeEvidence } from "@/lib/consent-evidence";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email address").max(320),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to agree to receive the newsletter" }) }),
  website: z.string().optional(), // honeypot
});

/**
 * Footer newsletter sign-up, double opt-in (ICO's recommended practice under
 * PECR reg. 22): the address is recorded with the consent evidence and a
 * confirmation link is emailed; marketing consent is only switched on when
 * that link is opened (see /newsletter/confirm/[token]). A contact who is
 * already subscribed is told so and nothing changes. Sign-ups never confirmed
 * are purged by the retention job.
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
  if (payload.website) return NextResponse.json({ ok: true, status: "confirm" }); // bot: pretend

  const email = payload.email.toLowerCase();
  const [firstName, ...rest] = payload.name.split(/\s+/);
  const lastName = rest.join(" ") || null;
  const evidence = consentEvidence(req, "newsletter");
  const token = randomBytes(24).toString("hex");
  const now = new Date().toISOString();

  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id, marketing_consent, unsubscribed_at, consent_evidence")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    const row = existing as
      | { id: string; marketing_consent: boolean; unsubscribed_at: string | null; consent_evidence: unknown }
      | null;

    if (row?.marketing_consent && !row.unsubscribed_at) {
      return NextResponse.json({ ok: true, status: "already" });
    }

    if (row) {
      const { error } = await supabase
        .from("crm_contacts")
        .update({
          consent_confirm_token: token,
          consent_confirm_sent_at: now,
          consent_evidence: mergeEvidence(row.consent_evidence, "marketing", evidence),
        })
        .eq("id", row.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("crm_contacts").insert({
        first_name: firstName,
        last_name: lastName,
        email,
        marketing_consent: false,
        consent_source: "website_newsletter",
        consent_confirm_token: token,
        consent_confirm_sent_at: now,
        consent_evidence: mergeEvidence(null, "marketing", evidence),
        tags: ["newsletter"],
      });
      if (error) throw error;
    }

    await sendConfirmation(req, email, firstName ?? payload.name, token);
    return NextResponse.json({ ok: true, status: "confirm" });
  } catch (err) {
    console.error("[newsletter] failed:", err);
    return NextResponse.json({ error: "Could not sign you up right now — please try again." }, { status: 500 });
  }
}

async function sendConfirmation(req: NextRequest, to: string, name: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[newsletter] RESEND_API_KEY missing — confirmation not sent");
    return;
  }
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const from = process.env.BOOKING_FROM_EMAIL ?? `website@${req.nextUrl.hostname}`;
  const link = `${siteUrl}/newsletter/confirm/${token}`;
  const address = settings?.address?.replace(/\r?\n/g, ", ");
  await sendEmail(apiKey, {
    from: `${galleryName} <${from}>`,
    to,
    subject: `Please confirm your subscription to ${galleryName}`,
    text: [
      `Dear ${name},`,
      "",
      `Thank you for your interest in ${galleryName}. Please confirm that you would like to receive our newsletter by opening this link:`,
      link,
      "",
      "If you did not ask to subscribe, simply ignore this email and nothing further will be sent.",
      "",
      galleryName,
      address ?? "",
      `${siteUrl}/privacy`,
    ].join("\n"),
    html: `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for your interest in ${escapeHtml(galleryName)}. Please confirm that you would like to receive our newsletter:</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:4px">Confirm subscription</a></p>
<p style="color:#666;font-size:13px">If you did not ask to subscribe, simply ignore this email and nothing further will be sent.</p>
<p style="color:#666;font-size:12px">${escapeHtml(galleryName)}${address ? ` · ${escapeHtml(address)}` : ""} · <a href="${siteUrl}/privacy" style="color:#666">Privacy Notice</a></p>`,
  }, "[newsletter] confirmation");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
