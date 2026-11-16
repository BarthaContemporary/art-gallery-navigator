import { NextResponse } from "next/server";
import { createServiceClient } from "@jvb/db/server";
import { safeEqual } from "@/lib/secret";
import { sendEmail } from "@/lib/email";
import { designationNames, nameMatches, screeningTarget, type ScreeningTarget } from "@/lib/sanctions-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SANCTIONS_URL = "https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml";

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
 * potential name match (screening aid — every hit needs human review). A
 * name matches when a sanctioned name holds the contact's first given name
 * and every word of the surname (lib/sanctions-match.ts), so compound,
 * hyphenated and particle surnames and double given names are screened too.
 *
 * Scheduled fortnightly via Vercel Cron (Authorization: Bearer $CRON_SECRET,
 * header only).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // Header only — the ?secret= query fallback lands in access logs; drop it.
  if (!secret || !safeEqual(bearer, secret))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: contactsRaw, error: contactsErr } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name")
    .eq("kyc_status", "verified");
  // A failed read is not "no confirmed contacts": say so, and screen nobody.
  if (contactsErr) {
    console.error("[sanctions-screen] could not read the contacts to screen:", contactsErr.message);
    return NextResponse.json({ error: `Could not read the contacts to screen: ${contactsErr.message}` }, { status: 500 });
  }

  // Need a first + last of reasonable length to avoid noise.
  const targets: ScreeningTarget[] = ((contactsRaw ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
  }[])
    .map(screeningTarget)
    .filter((t): t is ScreeningTarget => t !== null);

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

  // Every name (aliases included) of every designation against every target.
  for (const d of designationNames(xml)) {
    for (const t of targets) {
      if (nameMatches(t, d.words)) {
        matches.push({
          contactId: t.id,
          contactName: t.name,
          sanctionedName: d.name,
          regime: d.regime,
          uid: d.uid,
        });
        matchedContactIds.add(t.id);
      }
    }
  }

  // Record results per screened contact. A write that fails leaves the
  // contact's previous result standing, so it is counted and reported
  // rather than passed off as screened.
  const nowIso = new Date().toISOString();
  let notRecorded = 0;
  for (const t of targets) {
    const { error: writeErr } = await supabase
      .from("crm_contacts")
      .update({
        last_screened_at: nowIso,
        sanctions_status: matchedContactIds.has(t.id) ? "potential_match" : "clear",
      })
      .eq("id", t.id);
    if (writeErr) {
      notRecorded++;
      console.error("[sanctions-screen] could not record a screening result:", writeErr.message);
    }
  }

  // Alert on any potential match.
  let emailed = false;
  let emailError: string | null = null;
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
        await sendEmail(
          apiKey,
          {
            from,
            to,
            subject: `AML alert: ${matches.length} sanctions match${matches.length === 1 ? "" : "es"} to review`,
            text: body,
          },
          "Sanctions alert",
        );
        emailed = true;
      } catch (e) {
        // The screening is still recorded even if the email fails, but a
        // refused alert must read as not sent (it used to report emailed:
        // true), and the reason goes to the log and the cron's response.
        emailError = e instanceof Error ? e.message : String(e);
        console.error("[sanctions-screen] alert email failed:", emailError);
      }
    }
  }

  // The alert has gone (or been tried) either way; a result that could not
  // be recorded fails the run so the cron shows it.
  return NextResponse.json(
    {
      screened: targets.length,
      matches: matches.length,
      contactsFlagged: matchedContactIds.size,
      listGenerated: dateGenerated,
      emailed,
      ...(emailError ? { emailError } : {}),
      ...(notRecorded > 0 ? { error: `Could not record the result for ${notRecorded} contact${notRecorded === 1 ? "" : "s"}`, notRecorded } : {}),
    },
    { status: notRecorded > 0 ? 500 : 200 },
  );
}
