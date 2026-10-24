import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@jvb/db/server";
import { hashKey, rateLimit } from "@jvb/db/rate-limit";
import { clientIp, OFFER_TOKEN } from "@/lib/form-fields";
import { signGrant, MAGIC_TTL_SECONDS } from "@/lib/offer-access";
import { noteSent, withinSendLimit } from "@/lib/send-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GALLERY_NAME = "Joost van den Bergh";

/**
 * Sign-in emails sent for one private link, and requests from one visitor
 * address, in an hour. The first counts only emails that went out
 * (lib/send-limit): each one is a working link in the recipient's own
 * inbox, so someone holding a leaked link cannot keep the recipient from
 * getting theirs by asking over and over. The second counts every request.
 */
const LINKS_PER_TOKEN = 5;
const REQUESTS_PER_IP = 20;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

interface RecipientRow {
  id: string;
  contact: { email: string | null; first_name: string | null; salutation: string | null } | null;
  offer: { access_password: string | null; title: string | null } | null;
}

/**
 * Email the recipient a short-lived sign-in link for a gated offer.
 * Always responds ok so the page can't be used to probe which addresses exist.
 * The email only ever goes to the address on the recipient's record; the
 * limits stop a leaked link being used to fill that inbox.
 */
export async function POST(req: Request) {
  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!OFFER_TOKEN.test(token)) return NextResponse.json({ ok: true });

  try {
    const db = createServiceClient();
    const ip = clientIp(req.headers);
    const sentKey = `offer-magic:sent:${hashKey(token)}`;
    const [tokenOk, ipOk] = await Promise.all([
      withinSendLimit(db, sentKey, 3600, LINKS_PER_TOKEN),
      ip ? rateLimit(db, `offer-magic:ip:${hashKey(ip)}`, 3600, REQUESTS_PER_IP) : Promise.resolve(true),
    ]);
    if (!tokenOk || !ipOk) {
      console.info("[offer] sign-in link not sent: request limit reached");
      return NextResponse.json({ ok: true });
    }

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
        // The first name can come from a website form: escaped, so it can
        // only ever read as text in the email.
        const name = escapeHtml(contact?.first_name ?? contact?.salutation ?? "there");
        await sendEmail(apiKey, {
          from,
          to: email,
          subject: `Your sign-in link — ${offer.title ?? "private viewing"}`,
          html: `<p>Dear ${name},</p>
<p>Here is your temporary link to view the selection. It can be used for the next 30 minutes.</p>
<p><a href="${link}">Open the private viewing</a></p>
<p>If you didn't request this, you can ignore this email.</p>
<p>${GALLERY_NAME}</p>`,
        }, "[offer] sign-in link");
        await noteSent(db, sentKey);
      } else {
        console.error("[offer] sign-in link not sent: RESEND_API_KEY not set");
      }
    }
  } catch (err) {
    // The response is deliberately identical either way; the log is not.
    console.error("[offer] sign-in link not sent:", err);
  }
  return NextResponse.json({ ok: true });
}
