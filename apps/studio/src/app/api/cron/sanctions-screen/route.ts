import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANCTIONS_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Target = { id: string; name: string; first: string; last: string };
type Match = {
  contactId: string;
  contactName: string;
  sanctionedName: string;
  regime: string;
  uid: string;
};

/**
 * UK Sanctions List screening. Runs contacts whose in-house AML is confirmed
 * (kyc_status = 'verified') against the FCDO consolidated list. Records
 * last_screened_at + sanctions_status per contact and emails an alert on any
 * potential name match (screening aid — every hit needs human review).
 *
 * Scheduled fortnightly via Vercel Cron (Authorization: Bearer $CRON_SECRET);
 * also callable manually with ?secret=$CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // Header only — the ?secret= query fallback lands in access logs; drop it.
  if (!secret || !safeEqual(bearer, secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: contactsRaw } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name")
    .eq("kyc_status", "verified");

  const targets: Target[] = ((contactsRaw ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }[])
    .map((c) => ({
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" "),
      first: norm(c.first_name ?? ""),
      last: norm(c.last_name ?? ""),
    }))
    // Need a first + last of reasonable length to avoid noise.
    .filter((t) => t.first.length >= 2 && t.last.length >= 3);

  if (targets.length === 0) {
    return NextResponse.json({ screened: 0, matches: 0, note: "no confirmed contacts" });
  }

  let xml: string;
  try {
    const res = await fetch(SANCTIONS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`list fetch ${res.status}`);
    xml = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "list fetch failed" },
      { status: 502 },
    );
  }

  const dateGenerated = /<DateGenerated>([^<]*)<\/DateGenerated>/.exec(xml)?.[1] ?? "";

  const matches: Match[] = [];
  const matchedContactIds = new Set<string>();

  // Walk each designation; test its every name against every target.
  const designationRe = /<Designation>([\s\S]*?)<\/Designation>/g;
  const nameBlockRe = /<Name>([\s\S]*?)<\/Name>/g;
  const namePartRe = /<Name[1-6]>([^<]*)<\/Name[1-6]>/g;
  let d: RegExpExecArray | null;
  while ((d = designationRe.exec(xml)) !== null) {
    const inner = d[1] ?? "";
    const regime = /<RegimeName>([^<]*)<\/RegimeName>/.exec(inner)?.[1]?.trim() ?? "";
    const uid = /<UniqueID>([^<]*)<\/UniqueID>/.exec(inner)?.[1]?.trim() ?? "";

    let nb: RegExpExecArray | null;
    while ((nb = nameBlockRe.exec(inner)) !== null) {
      const parts: string[] = [];
      let np: RegExpExecArray | null;
      const block = nb[1] ?? "";
      while ((np = namePartRe.exec(block)) !== null) {
        const part = np[1]?.trim();
        if (part) parts.push(part);
      }
      if (parts.length === 0) continue;
      const raw = parts.join(" ");
      const words = new Set(norm(raw).split(" ").filter(Boolean));
      if (words.size === 0) continue;
      for (const t of targets) {
        if (words.has(t.first) && words.has(t.last)) {
          matches.push({
            contactId: t.id,
            contactName: t.name,
            sanctionedName: raw,
            regime,
            uid,
          });
          matchedContactIds.add(t.id);
        }
      }
    }
  }

  // Record results per screened contact.
  const nowIso = new Date().toISOString();
  for (const t of targets) {
    await supabase
      .from("crm_contacts")
      .update({
        last_screened_at: nowIso,
        sanctions_status: matchedContactIds.has(t.id) ? "potential_match" : "clear",
      })
      .eq("id", t.id);
  }

  // Alert on any potential match.
  let emailed = false;
  if (matches.length > 0) {
    const apiKey = process.env.RESEND_API_KEY;
    const to =
      process.env.SANCTIONS_ALERT_EMAIL ??
      process.env.GALLERY_NOTIFICATIONS_EMAIL ??
      process.env.ADMIN_EMAIL;
    if (apiKey && to) {
      const from =
        process.env.SANCTIONS_FROM_EMAIL ??
        process.env.EMAIL_FROM ??
        "Joost van den Bergh <alerts@web.joostvandenbergh.com>";
      const body = [
        `UK Sanctions List screening — ${matches.length} potential match${matches.length === 1 ? "" : "es"} to review.`,
        `List generated: ${dateGenerated}. Screened ${targets.length} AML-confirmed contacts.`,
        "",
        ...matches.map(
          (m) =>
            `• Contact "${m.contactName}" ~ sanctioned name "${m.sanctionedName}" (${m.regime || "regime n/a"}, ID ${m.uid || "n/a"})`,
        ),
        "",
        "These are name-similarity flags only and must be reviewed with your AML adviser. Open each contact in the studio to confirm or clear.",
      ].join("\n");
      try {
        await new Resend(apiKey).emails.send({
          from,
          to,
          subject: `AML alert: ${matches.length} sanctions match${matches.length === 1 ? "" : "es"} to review`,
          text: body,
        });
        emailed = true;
      } catch {
        // screening still recorded even if the email fails
      }
    }
  }

  return NextResponse.json({
    screened: targets.length,
    matches: matches.length,
    contactsFlagged: matchedContactIds.size,
    listGenerated: dateGenerated,
    emailed,
  });
}
