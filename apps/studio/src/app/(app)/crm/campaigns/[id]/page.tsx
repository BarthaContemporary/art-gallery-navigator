import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase, getSession } from "@/lib/supabase";
import {
  compileNewsletter,
  personalise,
  emptyDesign,
  type NewsletterDesign,
} from "@/lib/newsletter";
import {
  GALLERY_NAME,
  GALLERY_ADDRESS,
  DEFAULT_FROM,
  PUBLIC_BASE_URL,
} from "@/lib/site";
import { CampaignDesigner } from "@/components/campaign-designer";
import { SubmitButton } from "@/components/submit-button";
import { loadListContacts, countEligible, isMailable } from "@/lib/crm-list-members";
import { writeInChunks } from "@/lib/chunk";
import {
  sendEmail,
  emailIdempotencyKey,
  emailErrorCode,
  emailErrorDetail,
  describeEmailError,
} from "@/lib/email";
// London time: this page renders on the server, where the zone is UTC.
import { formatDateTime, formatTime } from "@/lib/format";

export const metadata = { title: "Newsletter" };

// The send runs inside this page's server action, which shares the page's
// time limit. Without it the platform default cut a list send off part way.
export const maxDuration = 300;

/**
 * A run stops starting new emails after this long and parks the newsletter as
 * part-sent, so it ends on its own terms well inside maxDuration instead of
 * being killed mid-loop.
 */
const SEND_BUDGET_MS = 240_000;

/**
 * A "sending" claim older than this belongs to a run that ended without
 * finishing (no run outlives maxDuration), so it may be taken over: that is
 * the Resume path after a crash or a timeout.
 */
const SEND_LEASE_MS = 6 * 60_000;

function claimIsStale(updatedAt: string | null | undefined): boolean {
  const t = updatedAt ? Date.parse(updatedAt) : NaN;
  return !Number.isFinite(t) || Date.now() - t > SEND_LEASE_MS;
}

/** Recipient rows still to be mailed: added for this send, or refused last time. */
const UNSENT = ["pending", "failed"];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Campaign = {
  id: string;
  name: string;
  subject: string | null;
  preview_text: string | null;
  from_address: string | null;
  list_id: string | null;
  design: NewsletterDesign | null;
  body_html: string | null;
  status: string;
  sent_at: string | null;
  updated_at: string | null;
};

type ListLite = { id: string; name: string; is_dynamic: boolean | null; filter_rules: unknown };

type MemberContact = {
  id: string;
  first_name: string | null;
  salutation: string | null;
  email: string | null;
  marketing_consent: boolean;
  do_not_mail: boolean;
  unsubscribed_at: string | null;
};

function salutationFor(c: MemberContact): string {
  if (c.salutation && c.salutation.trim()) return c.salutation.trim();
  if (c.first_name && c.first_name.trim()) return `Dear ${c.first_name.trim()}`;
  return "Dear friend";
}

async function unsubscribeUrlFor(
  db: Awaited<ReturnType<typeof getSupabase>>,
  contactId: string,
): Promise<string> {
  const { data: existing } = await db
    .from("unsubscribe_tokens")
    .select("token")
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();
  let token = (existing as { token: string } | null)?.token;
  if (!token) {
    const { data: created } = await db
      .from("unsubscribe_tokens")
      .insert({ contact_id: contactId })
      .select("token")
      .single();
    token = (created as { token: string } | null)?.token;
  }
  return `${PUBLIC_BASE_URL}/api/unsubscribe/${token}`;
}

export default async function CampaignDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sent?: string;
    skipped?: string;
    failed?: string;
    left?: string;
    reason?: string;
    test?: string;
    err?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();

  const { data: campaignRow } = await supabase
    .from("crm_campaigns")
    .select(
      "id, name, subject, preview_text, from_address, list_id, design, body_html, status, sent_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!campaignRow) notFound();
  const campaign = campaignRow as Campaign;
  const design = campaign.design ?? emptyDesign();

  const { data: listData } = await supabase
    .from("crm_lists")
    .select("id, name, is_dynamic, filter_rules")
    .order("sort_order")
    .order("name");
  const lists = (listData ?? []) as unknown as ListLite[];

  // ---- send a test to one address -----------------------------------------
  async function sendTest(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const session = await getSession();
    const to = String(formData.get("test_email") ?? "").trim() || session?.user.email || "";
    if (!to) redirect(`/crm/campaigns/${id}?err=notest`);

    const { data: c } = await db
      .from("crm_campaigns")
      .select("subject, from_address, design, preview_text")
      .eq("id", id)
      .maybeSingle();
    const cc = c as Pick<Campaign, "subject" | "from_address" | "design" | "preview_text"> | null;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) redirect(`/crm/campaigns/${id}?err=nokey`);

    const html = compileNewsletter(cc?.design ?? emptyDesign(), {
      galleryName: GALLERY_NAME,
      galleryAddress: GALLERY_ADDRESS,
      previewText: cc?.preview_text ?? undefined,
      salutation: "Dear friend",
      unsubscribeUrl: `${PUBLIC_BASE_URL}/api/unsubscribe/preview`,
    });
    try {
      // Throws when Resend refuses the email; awaiting the SDK alone reported
      // a refused test (unverified From address, say) as sent.
      await sendEmail(
        apiKey,
        {
          from: cc?.from_address || DEFAULT_FROM,
          to,
          subject: `[TEST] ${cc?.subject ?? "Newsletter"}`,
          html,
        },
        "Newsletter test",
      );
    } catch (e) {
      redirect(`/crm/campaigns/${id}?err=testfail&reason=${encodeURIComponent(emailErrorCode(e))}`);
    }
    redirect(`/crm/campaigns/${id}?test=${encodeURIComponent(to)}`);
  }

  // ---- send to the whole list ---------------------------------------------
  /*
   * Safe to press twice, and safe to cut short.
   *
   * - The send is claimed first: the status moves to "sending" only if it is
   *   still the one just read, so of two presses (or two tabs) exactly one
   *   gets the row back and the other stops with "already being sent".
   * - Every eligible contact gets a "pending" recipient row before anything
   *   goes out, and each row is marked "sent" or "failed" as its email goes.
   *   The rows, not the campaign status, record who has been mailed, so a
   *   resumed run mails only pending and failed rows.
   * - Each email carries an idempotency key, so a contact whose email left
   *   but whose row was never marked (the request died between the two) is
   *   not mailed again on resume.
   * - The run stops starting new emails after SEND_BUDGET_MS and parks the
   *   newsletter as "partial", with a Resume button, rather than being
   *   killed mid-loop.
   * - It is "sent" once no row is pending. Rows Resend refused stay
   *   "failed" and are reported, and the sent view offers to retry just
   *   those (nobody who joined the list since is added then), so one dead
   *   address cannot hold a newsletter part-sent for ever.
   */
  async function sendCampaign() {
    "use server";
    const db = await getSupabase();

    const { data: c } = await db
      .from("crm_campaigns")
      .select("subject, from_address, list_id, design, preview_text, status, sent_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    const cc = c as
      | (Pick<
          Campaign,
          "subject" | "from_address" | "list_id" | "design" | "preview_text" | "sent_at"
        > & {
          status: string;
          updated_at: string | null;
        })
      | null;
    if (!cc) redirect(`/crm/campaigns/${id}?err=missing`);
    // Once a newsletter has been sent (sent_at is set when it first is), a
    // further run only retries the emails Resend refused.
    const retryOnly = cc!.status === "sent" || Boolean(cc!.sent_at);
    if (cc!.status === "sent") {
      const { count: refused } = await db
        .from("crm_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "failed");
      if (!refused) redirect(`/crm/campaigns/${id}?err=already`);
    }
    if (cc!.status === "sending" && !claimIsStale(cc!.updated_at)) {
      redirect(`/crm/campaigns/${id}?err=sending`);
    }
    if (!cc!.list_id) redirect(`/crm/campaigns/${id}?err=nolist`);
    if (!cc!.subject) redirect(`/crm/campaigns/${id}?err=nosubject`);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) redirect(`/crm/campaigns/${id}?err=nokey`);

    const { data: sendList } = await db
      .from("crm_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", cc!.list_id)
      .maybeSingle();
    if (!sendList) redirect(`/crm/campaigns/${id}?err=nolist`);
    // Consent is still filtered per recipient below, so a dynamic "everyone"
    // list cannot mail anyone who has not opted in.
    const contacts = await loadListContacts<MemberContact & { id: string }>(
      db,
      sendList!,
      "id, first_name, salutation, email, marketing_consent, do_not_mail, unsubscribed_at",
    );
    const eligible = contacts.filter(isMailable);
    if (eligible.length === 0 && cc!.status === "draft") {
      redirect(`/crm/campaigns/${id}?err=noeligible`);
    }

    // Claim it. Taking over a dead run also matches the timestamp judged
    // stale, so two people resuming at once cannot both win.
    let claim = db
      .from("crm_campaigns")
      .update({ status: "sending" })
      .eq("id", id)
      .eq("status", cc!.status);
    if (cc!.status === "sending") claim = claim.eq("updated_at", cc!.updated_at);
    const { data: claimed } = await claim.select("id");
    if (!claimed || claimed.length === 0) redirect(`/crm/campaigns/${id}?err=sending`);

    let sent = 0;
    let outcome: string;
    try {
      // A row for everyone eligible. ignoreDuplicates leaves rows from an
      // earlier run (sent, opened, failed) exactly as they are.
      if (eligible.length > 0 && !retryOnly) {
        const { error: rowsError } = await db.from("crm_campaign_recipients").upsert(
          eligible.map((c2) => ({ campaign_id: id, contact_id: c2.id, status: "pending" })),
          { onConflict: "campaign_id,contact_id", ignoreDuplicates: true },
        );
        if (rowsError) throw new Error(rowsError.message);
      }

      const { data: todoRows, error: todoError } = await db
        .from("crm_campaign_recipients")
        .select("id, contact_id")
        .eq("campaign_id", id)
        .in("status", UNSENT);
      if (todoError) throw new Error(todoError.message);
      const todo = (todoRows ?? []) as { id: string; contact_id: string }[];
      const byContact = new Map(eligible.map((c2) => [c2.id, c2]));

      // Unsent rows for people who can no longer be mailed (consent
      // withdrawn, unsubscribed, off the list since the last run) were never
      // mailed: drop them, or the newsletter would stay part-sent for ever.
      const gone = todo.filter((r) => !byContact.has(r.contact_id)).map((r) => r.id);
      if (gone.length > 0) {
        const { error: goneError } = await writeInChunks(gone, (chunk) =>
          db.from("crm_campaign_recipients").delete().in("id", chunk),
        );
        if (goneError) throw new Error(goneError.message);
      }

      const compiled = compileNewsletter(cc!.design ?? emptyDesign(), {
        galleryName: GALLERY_NAME,
        galleryAddress: GALLERY_ADDRESS,
        previewText: cc!.preview_text ?? undefined,
      });
      const from = cc!.from_address || DEFAULT_FROM;
      const subject = cc!.subject as string;
      const started = Date.now();
      let failed = 0;
      let reason = "";

      for (const row of todo) {
        const contact = byContact.get(row.contact_id);
        if (!contact) continue;
        if (Date.now() - started > SEND_BUDGET_MS) break;
        const unsubscribeUrl = await unsubscribeUrlFor(db, contact.id);
        const html = personalise(compiled, {
          salutation: salutationFor(contact),
          unsubscribeUrl,
        });
        const to = contact.email as string;
        let resendId: string;
        try {
          resendId = await sendEmail(
            apiKey,
            {
              from,
              to,
              subject,
              html,
              headers: {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            },
            "Newsletter",
            {
              idempotencyKey: emailIdempotencyKey(`campaign-${id}-${contact.id}`, {
                from,
                to,
                subject,
                html,
              }),
            },
          );
        } catch (e) {
          // Refused: the row is marked "failed", not sent, so Resume (or
          // Retry failed, once the rest has gone) sends it again.
          failed++;
          reason ||= emailErrorCode(e);
          await db.from("crm_campaign_recipients").update({ status: "failed" }).eq("id", row.id);
          await db.from("email_events").insert({
            event_type: "failed",
            campaign_recipient_id: row.id,
            payload: { error: emailErrorCode(e), message: emailErrorDetail(e) },
          });
          continue;
        }
        await db
          .from("crm_campaign_recipients")
          .update({ status: "sent", resend_email_id: resendId })
          .eq("id", row.id);
        await db.from("email_events").insert({
          event_type: "sent",
          campaign_recipient_id: row.id,
          payload: { resend_id: resendId },
        });
        sent++;
      }

      // "sent" once nobody is waiting; until then it can be resumed. A retry
      // keeps the date it was first sent.
      const { count: left, error: leftError } = await db
        .from("crm_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", id)
        .eq("status", "pending");
      if (leftError) throw new Error(leftError.message);
      await db
        .from("crm_campaigns")
        .update(
          left
            ? { status: "partial" }
            : { status: "sent", sent_at: cc!.sent_at ?? new Date().toISOString() },
        )
        .eq("id", id);
      const skipped = contacts.length - eligible.length;
      outcome = `sent=${sent}&skipped=${skipped}&failed=${failed}&left=${left ?? 0}${
        reason ? `&reason=${encodeURIComponent(reason)}` : ""
      }`;
    } catch (e) {
      console.error("[newsletter] send stopped:", e);
      // Let go of the claim. The recipient rows already say who was mailed,
      // so the next Send or Resume skips them either way.
      await db
        .from("crm_campaigns")
        .update({
          status: retryOnly ? "sent" : sent > 0 || cc!.status !== "draft" ? "partial" : "draft",
        })
        .eq("id", id);
      revalidatePath(`/crm/campaigns/${id}`);
      redirect(`/crm/campaigns/${id}?err=sendfail`);
    }
    revalidatePath(`/crm/campaigns/${id}`);
    redirect(`/crm/campaigns/${id}?${outcome}`);
  }

  // ---- sent view: tracking summary ----------------------------------------
  if (campaign.status === "sent") {
    const { data: recs } = await supabase
      .from("crm_campaign_recipients")
      .select("status, opened_at, clicked_at, bounced_at")
      .eq("campaign_id", id);
    const rows = (recs ?? []) as {
      status: string;
      opened_at: string | null;
      clicked_at: string | null;
      bounced_at: string | null;
    }[];
    // Refused rows were never sent, so they are not recipients.
    const refused = rows.filter((r) => r.status === "failed").length;
    const total = rows.length - refused;
    const opened = rows.filter((r) => r.opened_at).length;
    const clicked = rows.filter((r) => r.clicked_at).length;
    const bounced = rows.filter((r) => r.bounced_at).length;
    const stat = (n: number) =>
      total ? `${n} · ${Math.round((n / total) * 100)}%` : String(n);

    return (
      <div className="max-w-[720px]">
        <Link href="/crm/campaigns" className="text-[12.5px] text-ink-soft">
          ← All newsletters
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <h1 className="text-[22px] font-semibold text-ink-strong">{campaign.name}</h1>
          <span className="bg-oranje/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-accent-deep">
            Sent
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          {campaign.subject} · sent{" "}
          {formatDateTime(campaign.sent_at)}
        </p>

        {sp.err === "sendfail" || sp.err === "sending" || refused > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] text-ink-body">
            <span>
              {sp.err === "sendfail"
                ? "The retry stopped on an error. "
                : sp.err === "sending"
                  ? "A retry is already running. "
                  : ""}
              {refused > 0
                ? `${plural(refused, "email")} could not be sent${
                    sp.reason ? ` (${describeEmailError(sp.reason)})` : ""
                  }.`
                : null}
            </span>
            {refused > 0 ? (
              <form action={sendCampaign}>
                <SubmitButton pendingLabel="Retrying…" variant="ghost">
                  Retry failed ({refused})
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Recipients", String(total)],
            ["Opened", stat(opened)],
            ["Clicked", stat(clicked)],
            ["Bounced", stat(bounced)],
          ].map(([label, value]) => (
            <div key={label} className="border border-line bg-cell p-4">
              <dt className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                {label}
              </dt>
              <dd className="mt-1 font-mono text-[18px] text-ink-strong">{value}</dd>
            </div>
          ))}
        </dl>

        {campaign.body_html ? (
          <div className="mt-6">
            <p className="mb-2 text-[11px] uppercase tracking-[0.06em] text-ink-faint">
              What was sent
            </p>
            <iframe
              title="Sent newsletter"
              srcDoc={personalise(campaign.body_html, {
                salutation: "Dear friend",
                unsubscribeUrl: "#",
              })}
              className="h-[600px] w-full border border-line bg-white"
            />
          </div>
        ) : null}
      </div>
    );
  }

  // ---- draft view: the designer -------------------------------------------
  // Who this newsletter has already reached, from its recipient rows: a
  // part-sent one counts and resumes with only the rest.
  const { data: recRows } = await supabase
    .from("crm_campaign_recipients")
    .select("contact_id, status")
    .eq("campaign_id", id);
  const mailed = new Set<string>();
  let failedCount = 0;
  for (const r of (recRows ?? []) as { contact_id: string; status: string }[]) {
    if (r.status === "failed") failedCount++;
    else if (r.status !== "pending") mailed.add(r.contact_id);
  }
  const sendState: "draft" | "sending" | "stale" | "partial" =
    campaign.status === "sending"
      ? claimIsStale(campaign.updated_at)
        ? "stale"
        : "sending"
      : campaign.status === "partial" || mailed.size > 0
        ? "partial"
        : "draft";

  const failedN = Number(sp.failed ?? 0);
  const leftN = Number(sp.left ?? 0);
  const banner =
    sp.sent !== undefined
      ? `Sent to ${sp.sent} recipient${sp.sent === "1" ? "" : "s"}${
          sp.skipped && sp.skipped !== "0" ? ` · ${sp.skipped} skipped (no consent / no email)` : ""
        }${failedN > 0 ? ` · ${failedN} failed (${describeEmailError(sp.reason)})` : ""}${
          leftN > 0 ? `. ${leftN} still to send: press Resume sending to continue.` : "."
        }`
      : sp.test
        ? `Test sent to ${sp.test}.`
        : sp.err === "nokey"
          ? "No RESEND_API_KEY configured — set it to send."
          : sp.err === "nolist"
            ? "Choose an audience list before sending."
            : sp.err === "nosubject"
              ? "Add a subject line before sending."
              : sp.err === "testfail"
                ? `Test send failed (${describeEmailError(sp.reason)}). Check the From address and API key.`
                : sp.err === "already"
                  ? "This newsletter has already been sent."
                  : sp.err === "sending"
                    ? "This newsletter is already being sent. Reload in a minute to see the result."
                    : sp.err === "noeligible"
                      ? "Nobody on this list can be mailed: each needs an email address and marketing consent, and must not be unsubscribed or marked do not mail."
                      : sp.err === "sendfail"
                        ? "Sending stopped on an error. Everyone already mailed is recorded and will not be mailed again: press Resume sending to continue."
                        : sendState === "sending"
                          ? `This newsletter is being sent (started ${formatTime(campaign.updated_at)}). Reload to see when it has finished.`
                          : sendState === "stale"
                            ? `Sending stopped before it finished (last activity ${formatDateTime(campaign.updated_at)}). Resume sending mails only those not yet reached.`
                            : sendState === "partial"
                              ? `Partly sent: ${mailed.size} mailed${
                                  failedCount > 0 ? `, ${failedCount} failed` : ""
                                }. Resume sending mails only those not yet reached.`
                              : null;

  // Real counts, not the crm_list_members(count) embed — that returns 0 for a
  // dynamic list and would understate the audience before a send. Each list
  // also says how many the send would reach (consent and the rest, less
  // anyone this newsletter has already mailed), which is what the Send button
  // shows; the raw list size overstated it.
  const audience = new Map(
    await Promise.all(
      lists.map(async (l) => [l.id, await countEligible(supabase, l, mailed)] as const),
    ),
  );

  return (
    <div>
      <CampaignDesigner
        campaignId={campaign.id}
        initialName={campaign.name}
        initialSubject={campaign.subject ?? ""}
        initialPreview={campaign.preview_text ?? ""}
        initialFrom={campaign.from_address ?? ""}
        initialListId={campaign.list_id ?? ""}
        initialDesign={design}
        lists={lists.map((l) => ({
          id: l.id,
          name: l.name,
          count: audience.get(l.id)?.total ?? 0,
          eligible: audience.get(l.id)?.eligible ?? 0,
        }))}
        defaultFrom={DEFAULT_FROM}
        galleryName={GALLERY_NAME}
        galleryAddress={GALLERY_ADDRESS}
        sendTest={sendTest}
        sendCampaign={sendCampaign}
        sendState={sendState}
        header={
          <Link href="/crm/campaigns" className="text-[12.5px] text-ink-soft">
            ← All newsletters
          </Link>
        }
        notice={
          banner ? (
            <p className="mt-3 rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] text-ink-body">
              {banner}
            </p>
          ) : null
        }
      />
    </div>
  );
}
