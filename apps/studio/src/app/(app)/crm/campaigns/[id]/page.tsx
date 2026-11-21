import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase, getSession, hasRole, createServiceClient } from "@/lib/supabase";
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
import { loadListContacts, countEligible, isMailable } from "@/lib/crm-list-members";
import { chunkIds, selectInChunks, writeInChunks } from "@/lib/chunk";
import { logEmailEvent } from "@/lib/email-log";
import {
  sendEmail,
  emailIdempotencyKey,
  emailErrorCode,
  emailErrorDetail,
  describeEmailError,
} from "@/lib/email";
// London time: this page renders on the server, where the zone is UTC.
import { formatCount, formatDateTime, formatTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlashNotice, Notice } from "@/components/ui/notice";

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

type Db = Awaited<ReturnType<typeof getSupabase>>;

/**
 * Each recipient's unsubscribe token, read (and the missing ones created)
 * before anyone is mailed. Any failed read or write throws, so the send stops
 * before an email goes out with a dead opt-out link
 * (…/api/unsubscribe/undefined, which the website answers "Link not
 * recognised"): every marketing email must carry a working one.
 *
 * A contact's oldest token is used, and the same one on every run: the link
 * is part of the email, and so of the idempotency key that keeps a resumed
 * send from mailing anyone twice.
 */
async function loadUnsubscribeTokens(db: Db, contactIds: string[]): Promise<Map<string, string>> {
  const tokens = new Map<string, string>();
  // Chunked by contact, so all of a contact's tokens arrive in one chunk,
  // oldest first.
  const found = await selectInChunks<{ contact_id: string; token: string }>(contactIds, (chunk) =>
    db
      .from("unsubscribe_tokens")
      .select("contact_id, token, created_at")
      .in("contact_id", chunk)
      .order("created_at")
      .order("id"),
  );
  for (const t of found) if (t.token && !tokens.has(t.contact_id)) tokens.set(t.contact_id, t.token);
  const missing = [...new Set(contactIds)].filter((cid) => !tokens.has(cid));
  for (const chunk of chunkIds(missing, 500)) {
    const { data, error } = await db
      .from("unsubscribe_tokens")
      .insert(chunk.map((contact_id) => ({ contact_id })))
      .select("contact_id, token");
    if (error) throw new Error(`Could not create unsubscribe links: ${error.message}`);
    for (const t of (data ?? []) as { contact_id: string; token: string }[]) tokens.set(t.contact_id, t.token);
  }
  return tokens;
}

/**
 * Resend's refusals that are about the sender, not the recipient: every
 * further email of the run would be refused the same way, so the run stops
 * at the first and leaves the rest unsent. Not validation_error, which Resend
 * also returns for one malformed recipient address, and not no_response.
 */
const SENDER_REFUSALS = new Set([
  "missing_api_key",
  "invalid_api_Key",
  "invalid_api_key",
  "restricted_api_key",
  "invalid_from_address",
  "daily_quota_exceeded",
  "monthly_quota_exceeded",
]);

/** Recipient rows of this newsletter that were ever mailed (any status but pending or failed); null if the count failed. */
async function mailedSoFar(db: Db, campaignId: string): Promise<number | null> {
  const { count, error } = await db
    .from("crm_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .not("status", "in", `(${UNSENT.join(",")})`);
  return error ? null : (count ?? 0);
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
    draft?: string;
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
    // Checked here as in sendCampaign: a server action can be called on its
    // own, and this one sends from the gallery's address.
    const session = await getSession();
    if (!session || !hasRole(session.roles, "admin", "staff")) throw new Error("Forbidden");
    const db = await getSupabase();
    const to = String(formData.get("test_email") ?? "").trim() || session.user.email || "";
    if (!to) redirect(`/crm/campaigns/${id}?err=notest`);

    const { data: c } = await db
      .from("crm_campaigns")
      .select("subject, from_address, design, preview_text")
      .eq("id", id)
      .maybeSingle();
    const cc = c as Pick<Campaign, "subject" | "from_address" | "design" | "preview_text"> | null;
    // Never a test of an empty design: the campaign is gone or not readable.
    if (!cc) redirect(`/crm/campaigns/${id}?err=missing`);
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
   * - Unless nothing has ever gone out: a first send whose every email was
   *   refused (an unverified From address, a refused key) goes back to
   *   "draft", so the cause can be corrected in the designer. Marked "sent",
   *   it was locked with the cause in it, and Retry failed for ever. The
   *   refused rows stay "failed" and the next Send mails them. (A refusal
   *   coded no_response may in fact have gone out; once the From address or
   *   design changes, the idempotency key changes with it, so such a contact
   *   could be mailed a second time. Rare, and said here so it is known.)
   */
  async function sendCampaign() {
    "use server";
    // Checked here, not only by the page: a server action can be called on
    // its own, and the send log below is written with the service client.
    const session = await getSession();
    if (!session || !hasRole(session.roles, "admin", "staff")) throw new Error("Forbidden");
    const db = await getSupabase();
    const audit = createServiceClient();

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

    // Claim it against the row as it was read: its status and its
    // updated_at, which every edit stamps. So a subject, sender or design
    // changed since the read above (another tab, a colleague) is never sent
    // in the form read here, and of two people sending or resuming a dead
    // run at once only one wins.
    const { data: claimed, error: claimError } = await db
      .from("crm_campaigns")
      .update({ status: "sending" })
      .eq("id", id)
      .eq("status", cc!.status)
      .eq("updated_at", cc!.updated_at)
      .select("id");
    if (claimError) {
      redirect(`/crm/campaigns/${id}?error=${encodeURIComponent(`Nothing was sent: ${claimError.message}`)}`);
    }
    if (!claimed || claimed.length === 0) {
      // Lost to a send that started meanwhile, or to an edit made since the
      // read: say which.
      const { data: now } = await db.from("crm_campaigns").select("status").eq("id", id).maybeSingle();
      if (now && (now as { status: string }).status === cc!.status && cc!.status !== "sending") {
        redirect(
          `/crm/campaigns/${id}?error=${encodeURIComponent(
            "The newsletter was changed while the send was starting, so nothing was sent. Check it and press Send again.",
          )}`,
        );
      }
      redirect(`/crm/campaigns/${id}?err=sending`);
    }

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

      // Every recipient's opt-out link, before anyone is mailed (throws on a
      // failed read or write, which parks the send below).
      const tokens = await loadUnsubscribeTokens(
        db,
        todo.map((r) => r.contact_id).filter((cid) => byContact.has(cid)),
      );

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
        const token = tokens.get(contact.id);
        // Never mailed without a working opt-out link.
        if (!token) throw new Error("No unsubscribe link for a recipient");
        const unsubscribeUrl = `${PUBLIC_BASE_URL}/api/unsubscribe/${token}`;
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
          const code = emailErrorCode(e);
          reason ||= code;
          await db.from("crm_campaign_recipients").update({ status: "failed" }).eq("id", row.id);
          await logEmailEvent(
            audit,
            {
              event_type: "failed",
              campaign_recipient_id: row.id,
              payload: { error: code, message: emailErrorDetail(e) },
            },
            "newsletter",
          );
          // The sender itself was refused: the rest would be too. They stay
          // unsent for the next run.
          if (SENDER_REFUSALS.has(code)) break;
          continue;
        }
        await db
          .from("crm_campaign_recipients")
          .update({ status: "sent", resend_email_id: resendId })
          .eq("id", row.id);
        await logEmailEvent(
          audit,
          { event_type: "sent", campaign_recipient_id: row.id, payload: { resend_id: resendId } },
          "newsletter",
        );
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
      // Nothing has ever gone out (this run sent none, and no earlier run
      // either): back to draft, so the cause can be corrected.
      let backToDraft = false;
      if (!cc!.sent_at && sent === 0) {
        const mailed = await mailedSoFar(db, id);
        if (mailed === null) throw new Error("Could not count the recipients already mailed");
        backToDraft = mailed === 0;
      }
      await db
        .from("crm_campaigns")
        .update(
          backToDraft
            ? { status: "draft" }
            : left
              ? { status: "partial" }
              : { status: "sent", sent_at: cc!.sent_at ?? new Date().toISOString() },
        )
        .eq("id", id);
      const skipped = contacts.length - eligible.length;
      outcome = `sent=${sent}&skipped=${skipped}&failed=${failed}&left=${left ?? 0}${
        reason ? `&reason=${encodeURIComponent(reason)}` : ""
      }${backToDraft ? "&draft=1" : ""}`;
    } catch (e) {
      console.error("[newsletter] send stopped:", e);
      // Let go of the claim. The recipient rows already say who was mailed,
      // so the next Send or Resume skips them either way. A newsletter that
      // has never reached anyone goes back to draft, as above; if that
      // cannot be told, it is parked as part-sent, as before.
      let status: "sent" | "partial" | "draft";
      if (retryOnly) status = "sent";
      else if (sent > 0) status = "partial";
      else if (cc!.status === "draft") status = "draft";
      else status = (await mailedSoFar(db, id)) === 0 ? "draft" : "partial";
      await db.from("crm_campaigns").update({ status }).eq("id", id);
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
      total ? `${formatCount(n)} · ${Math.round((n / total) * 100)}%` : formatCount(n);

    return (
      <div className="max-w-[var(--jvb-measure-wide)]">
        <PageHeader
          back={{ href: "/crm/campaigns", label: "All newsletters" }}
          title={campaign.name}
          meta={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge>Sent</Badge>
              <span>
                {campaign.subject ? `${campaign.subject} · ` : ""}sent {formatDateTime(campaign.sent_at)}
              </span>
            </span>
          }
        />

        <div className="space-y-6">
          {/* The result a send or retry redirected with (the skipped count,
              err=nolist, nokey or already), which this view used to drop, so
              a refused Retry seemed to do nothing. sendfail and sending are
              worded by the notice below, without the draft view's "Resume
              sending", a button this view does not have. */}
          {sp.err !== "sendfail" && sp.err !== "sending" ? <FlashNotice searchParams={sp} codes="campaign" /> : null}
          {sp.err === "sendfail" || sp.err === "sending" || refused > 0 ? (
            <Notice
              tone={sp.err === "sendfail" ? "danger" : "warn"}
              action={
                refused > 0 ? (
                  <form action={sendCampaign}>
                    <Button type="submit" size="sm" pendingLabel="Retrying…">
                      Retry failed ({refused})
                    </Button>
                  </form>
                ) : null
              }
            >
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
            </Notice>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
            {[
              ["Recipients", formatCount(total)],
              ["Opened", stat(opened)],
              ["Clicked", stat(clicked)],
              ["Bounced", stat(bounced)],
            ].map(([label, value]) => (
              <div key={label} className="border-t border-rule-strong pt-2">
                <dt className="label">{label}</dt>
                <dd className="tabular mt-1 text-[22px] font-light leading-[1.25] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {campaign.body_html ? (
            <Section title="What was sent">
              {/* White on purpose, in both themes: this is the email as a
                  reader's mail program draws it. Fully sandboxed (no
                  scripts, an origin of its own): body_html is stored HTML
                  that anyone with write access to the campaign could have
                  set, and an unsandboxed srcdoc frame runs as the studio
                  itself. A mail program runs no scripts either, so the
                  email looks the same; its links do not open from here. */}
              <iframe
                title="Sent newsletter"
                sandbox=""
                srcDoc={personalise(campaign.body_html, {
                  salutation: "Dear friend",
                  unsubscribeUrl: "#",
                })}
                className="h-[600px] w-full border border-rule bg-white"
              />
            </Section>
          ) : null}
        </div>
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

  // What the database says about an unfinished send, for when the URL
  // carries no message of its own (FlashNotice reads the codes the actions
  // redirect with: sent, skipped, failed, left, reason, test and err).
  const stateNotice =
    sendState === "sending" ? (
      <Notice tone="info">
        This newsletter is being sent (started {formatTime(campaign.updated_at)}). Reload to see when it has
        finished.
      </Notice>
    ) : sendState === "stale" ? (
      <Notice tone="warn">
        Sending stopped before it finished (last activity {formatDateTime(campaign.updated_at)}). Resume sending
        mails only those not yet reached.
      </Notice>
    ) : sendState === "partial" ? (
      <Notice tone="warn">
        Partly sent: {formatCount(mailed.size)} mailed
        {failedCount > 0 ? `, ${formatCount(failedCount)} failed` : ""}. Resume sending mails only those not yet
        reached.
      </Notice>
    ) : null;

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
        notice={<FlashNotice searchParams={sp} codes="campaign" fallback={stateNotice} />}
      />
    </div>
  );
}
