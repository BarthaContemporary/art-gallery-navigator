import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@jvb/db/server";
import { signGrant, MAGIC_TTL_SECONDS } from "@/lib/offer-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GALLERY_NAME = "Joost van den Bergh";

interface RecipientRow {
  id: string;
  contact: { email: string | null; first_name: string | null; salutation: string | null } | null;
  offer: { access_password: string | null; title: string | null } | null;
}

/**
 * Email the recipient a short-lived magic sign-in link for a gated offer.
 * Always responds ok so the page can't be used to probe which addresses exist.
 */
export async function POST(req: Request) {
  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!token || token.length < 8) return NextResponse.json({ ok: true });

  try {
    const db = createServiceClient();
    const { data } = await db
      .from("offer_recipients")
      .select(
        "id, contact:crm_contacts ( email, first_name, salutation ), offer:offers ( access_password, title )",
      )
      .eq("token", token)
      .maybeSingle();
    const rec = data as unknown as RecipientRow | null;
    const contact = rec?.contact
      ? Array.isArray(rec.contact)
        ? rec.contact[0]
        : rec.contact
      : null;
    const offer = rec?.offer
      ? Array.isArray(rec.offer)
        ? rec.offer[0]
        : rec.offer
      : null;
    const email = contact?.email ?? null;

    // Only meaningful for a gated offer with a known email address.
    if (offer?.access_password && email) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const origin = new URL(req.url).origin;
        const grant = signGrant(token, MAGIC_TTL_SECONDS, Date.now());
        const link = `${origin}/api/offer/enter?token=${encodeURIComponent(token)}&k=${encodeURIComponent(grant)}`;
        const from =
          process.env.OFFERS_FROM_EMAIL ??
          process.env.EMAIL_FROM ??
          `${GALLERY_NAME} <offers@web.joostvandenbergh.com>`;
        const name = contact?.first_name ?? contact?.salutation ?? "there";
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from,
          to: email,
          subject: `Your sign-in link — ${offer.title ?? "private viewing"}`,
          html: `<p>Dear ${name},</p>
<p>Here is your temporary link to view the selection. It works once and expires in 30 minutes.</p>
<p><a href="${link}">Open the private viewing</a></p>
<p>If you didn't request this, you can ignore this email.</p>
<p>${GALLERY_NAME}</p>`,
        });
      }
    }
  } catch {
    // Swallow — the response is deliberately identical either way.
  }
  return NextResponse.json({ ok: true });
}
