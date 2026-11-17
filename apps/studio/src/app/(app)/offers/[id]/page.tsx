import { SaveToDriveLink } from "@/components/save-to-drive";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { OfferEmail } from "@jvb/emails";
import { getSupabase, getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { OfferItemsEditor } from "@/components/offer-items-editor";
import { logEmailEvent } from "@/lib/email-log";
import { resolveListPieceIds, countListMembers, type ListRules } from "@/lib/list-members";
import { loadPieceSummaries } from "@/lib/piece-store";
import { pickContacts, pickWorks } from "@/lib/picker-search";
import { resolveListContactIds } from "@/lib/crm-list-members";
import { selectInChunks } from "@/lib/chunk";
import {
  sendEmail,
  emailIdempotencyKey,
  emailErrorCode,
  emailErrorDetail,
  describeEmailError,
} from "@/lib/email";
import { parseAmount } from "@/lib/amount";
// London time: this page renders on the server, where the zone is UTC.
import { formatCount, formatDate } from "@/lib/format";
import { OFFER_KIND_LABELS, labelOf, type Tone } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlashNotice } from "@/components/ui/notice";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { MailIcon, PlusIcon, SearchIcon } from "@/components/ui/icons";

export const metadata = { title: "Offer" };

// The send runs inside this page's server action, which shares the page's
// time limit. An offer can carry a whole contact list, and the platform
// default cut a list send off part way (as it did the newsletter's).
export const maxDuration = 300;

/**
 * A send stops starting new emails after this long and reports how many are
 * left, so it ends on its own terms well inside maxDuration. Pressing Send
 * again carries on: only recipients with no sent_at are mailed, and the
 * idempotency key covers the one in flight.
 */
const SEND_BUDGET_MS = 240_000;

// Where the tokenized public offer pages live (the web app).
const OFFER_BASE =
  process.env.OFFER_LINK_BASE_URL ?? "https://jvb-web.vercel.app";
const GALLERY_NAME = "Joost van den Bergh";

/*
 * Matching a client's reply note to their recipient row. The website's
 * offer-response route sets responded_at and, in the same request, writes the
 * note as an enquiry (channel "offer") that carries the contact but no link to
 * the offer. The enquiry nearest to responded_at, within this window (room
 * for the web server's and the database's clocks to differ), is the reply.
 */
const REPLY_MATCH_MS = 10 * 60_000;
/** The enquiry text the route writes when the client left no note. */
const AUTO_REPLY_TEXT = /^Interested in offer "[\s\S]*"\.$/;

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

type PieceLite = {
  id: string;
  stock_number: string | null;
  title: string | null;
  medium: string | null;
  period: string | null;
  /* Current availability, read live — an offer's membership is a snapshot but
     each work's status is not, so a piece sold after the offer was composed
     shows as sold here. */
  status?: string | null;
};

type Item = {
  id: string;
  price_override_gbp: number | null;
  note: string | null;
  sort_order: number | null;
  piece: PieceLite | null;
};

type Recipient = {
  id: string;
  token: string;
  sent_at: string | null;
  first_viewed_at: string | null;
  view_count: number | null;
  response: string | null;
  responded_at: string | null;
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    salutation: string | null;
    email: string | null;
    unsubscribed_at: string | null;
    /** Set by the Resend webhook on a permanent bounce; cleared when the email changes. */
    email_bounced_at: string | null;
  } | null;
};

/**
 * Whether an offer email can go to this contact: an address that is neither
 * unsubscribed nor hard-bounced. A bounce stops every later email, whichever
 * offer or newsletter it came from (the webhook's rule); the do-not-mail box
 * is left out of this, as it always was for offers.
 */
function canEmail(c: Recipient["contact"]): boolean {
  return Boolean(c?.email && !c.unsubscribed_at && !c.email_bounced_at);
}

/**
 * A recipient's state in a word and a tone. The client's own answer comes
 * first; a refused send is the one error, so the only danger.
 */
function recipientState(
  r: Recipient,
  failure: string | undefined,
): { word: string; tone: Tone; hollow?: boolean } {
  if (r.response === "interested") return { word: "Interested", tone: "ok" };
  if (r.response === "declined") return { word: "Declined", tone: "neutral" };
  if (r.response) return { word: labelOf({}, r.response), tone: "neutral" };
  if (r.first_viewed_at) return { word: "Viewed", tone: "info" };
  if (r.sent_at) return { word: "Sent", tone: "neutral" };
  if (failure !== undefined) return { word: `Send failed (${describeEmailError(failure)})`, tone: "danger" };
  return { word: "Not sent", tone: "neutral", hollow: true };
}

export default async function OfferDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    add?: string;
    rc?: string;
    sent?: string;
    skipped?: string;
    failed?: string;
    reason?: string;
    left?: string;
    unmarked?: string;
    error?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();
  // Read once (cached for the request) for the search boxes below: only
  // admin and staff searches reach the search index.
  const session = await getSession();
  const roles = session?.roles ?? [];

  const { data: offer } = await supabase
    .from("offers")
    .select("id, title, kind, intro, show_prices, expires_at, access_password, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!offer) notFound();

  const [
    { data: itemsData },
    { data: recipientsData },
    { data: lists },
    { data: pieceLists },
  ] = await Promise.all([
    supabase
      .from("offer_items")
      .select(
        "id, price_override_gbp, note, sort_order, piece_id",
      )
      .eq("offer_id", id)
      .order("sort_order", { nullsFirst: true }),
    supabase
      .from("offer_recipients")
      .select(
        "id, token, sent_at, first_viewed_at, view_count, response, responded_at, contact:crm_contacts ( id, first_name, last_name, salutation, email, unsubscribed_at, email_bounced_at )",
      )
      .eq("offer_id", id)
      .order("created_at"),
    supabase.from("crm_lists").select("id, name").order("sort_order").order("name"),
    supabase
      .from("piece_lists")
      .select("id, name, is_dynamic, filter_rules, piece_list_items(count)")
      .order("sort_order")
      .order("name"),
  ]);

  // Real sizes for the "add works from a list" picker. Counting
  // piece_list_items alone showed (0) against every live list, which is also
  // what made adding one appear to do nothing.
  const listOptions = await Promise.all(
    ((pieceLists ?? []) as unknown as {
      id: string;
      name: string;
      is_dynamic: boolean | null;
      filter_rules: ListRules | null;
      piece_list_items?: { count: number }[];
    }[]).map(async (l) => ({
      id: l.id,
      name: l.name,
      isDynamic: Boolean(l.is_dynamic),
      count: await countListMembers(supabase, l),
    })),
  );

  // Offer lines key on the shared identity, so the works are looked up in the
  // union view rather than embedded from a single stock table.
  const itemPieces = await loadPieceSummaries(
    supabase,
    ((itemsData ?? []) as { piece_id: string }[]).map((r) => r.piece_id),
  );
  const items = ((itemsData ?? []) as unknown as (Omit<Item, "piece"> & { piece_id: string })[]).map(
    (r) => ({ ...r, piece: itemPieces.get(r.piece_id) ?? null }),
  ) as unknown as Item[];
  const recipients = (recipientsData ?? []) as unknown as Recipient[];

  // The note a client left with "I'm interested", shown under their status.
  const replyNotes = new Map<string, string>();
  const interested = recipients.filter(
    (r) => r.response === "interested" && r.responded_at && r.contact?.id,
  );
  if (interested.length > 0) {
    const enquiries = await selectInChunks<{
      contact_id: string;
      message: string | null;
      created_at: string;
    }>(
      interested.map((r) => r.contact!.id),
      (chunk) =>
        supabase
          .from("enquiries")
          .select("contact_id, message, created_at")
          .eq("channel", "offer")
          .in("contact_id", chunk),
    ).catch(() => []);
    for (const r of interested) {
      const at = Date.parse(r.responded_at!);
      let best: { message: string | null; gap: number } | null = null;
      for (const e of enquiries) {
        if (e.contact_id !== r.contact!.id) continue;
        const gap = Math.abs(Date.parse(e.created_at) - at);
        if (gap <= REPLY_MATCH_MS && (!best || gap < best.gap)) best = { message: e.message, gap };
      }
      const note = best?.message?.trim();
      if (note && !AUTO_REPLY_TEXT.test(note)) replyNotes.set(r.id, note);
    }
  }

  // Why the last send to a still-unsent recipient was refused (sendOffer
  // records each refusal as an email_events "failed" row, through the service
  // client, whoever sent), newest first. Admin and staff can read
  // email_events; the accountant cannot, and sees "not sent" (true, just
  // without the reason).
  const sendFailures = new Map<string, string>();
  if (recipients.some((r) => !r.sent_at)) {
    const { data: fails } = await supabase
      .from("email_events")
      .select("offer_recipient_id, payload, created_at, offer_recipients!inner ( offer_id )")
      .eq("event_type", "failed")
      .eq("offer_recipients.offer_id", id)
      .order("created_at", { ascending: false });
    for (const f of (fails ?? []) as unknown as {
      offer_recipient_id: string;
      payload: { error?: string } | null;
    }[]) {
      if (!sendFailures.has(f.offer_recipient_id)) {
        sendFailures.set(f.offer_recipient_id, f.payload?.error ?? "");
      }
    }
  }
  const existingPieceIds = new Set(
    items.map((i) => i.piece?.id).filter((pid): pid is string => Boolean(pid)),
  );
  const existingContactIds = new Set(
    recipients.map((r) => r.contact?.id).filter((cid): cid is string => Boolean(cid)),
  );

  // Add-works search: ranked pieces_search, with the search index merged in
  // for admin and staff (typo-tolerant when nothing matches exactly), rows
  // from vw_pieces_list, the pieces already added taken out.
  //
  // Add-recipient contact search: the same trigram search as the contacts
  // page (crm_contacts_search, which also matches first and last name
  // together, "Hiroshi Tanaka", and tolerates typos; the term goes in as a
  // parameter, not into a filter string), the index merged in the same way,
  // rows from crm_contacts. Existing recipients are taken out before the
  // first 20 are kept, so a search whose best matches are all on the offer
  // still shows the others.
  //
  // A failed search shows as no matches, as it always did.
  const addQ = (sp.add ?? "").trim();
  const rcQ = (sp.rc ?? "").trim();
  const [workPick, contactPick] = await Promise.all([
    addQ ? pickWorks(supabase, addQ, { roles, exclude: existingPieceIds }) : null,
    rcQ ? pickContacts(supabase, rcQ, { roles, exclude: existingContactIds }) : null,
  ]);
  const workResults: PieceLite[] = workPick?.rows ?? [];
  const contactResults: Recipient["contact"][] = contactPick?.rows ?? [];

  const sentCount = recipients.filter((r) => r.sent_at).length;
  const sendable = recipients.filter((r) => !r.sent_at && canEmail(r.contact)).length;

  // ---- server actions -----------------------------------------------------
  async function updateOffer(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const expires = String(formData.get("expires_at") ?? "").trim();
    await db
      .from("offers")
      .update({
        title: String(formData.get("title") ?? "").trim() || "Untitled offer",
        kind: String(formData.get("kind") ?? "offer"),
        intro: String(formData.get("intro") ?? "").trim() || null,
        show_prices: formData.get("show_prices") === "on",
        expires_at: expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
        access_password: String(formData.get("access_password") ?? "").trim() || null,
      })
      .eq("id", id);
    revalidatePath(`/offers/${id}`);
  }

  async function addItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const pieceId = String(formData.get("piece_id") ?? "");
    if (!pieceId) return;
    const { data: mx } = await db
      .from("offer_items")
      .select("sort_order")
      .eq("offer_id", id)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    await db.from("offer_items").insert({
      offer_id: id,
      piece_id: pieceId,
      sort_order: (mx?.sort_order ?? -1) + 1,
    });
    revalidatePath(`/offers/${id}`);
  }

  async function addListItems(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const listId = String(formData.get("piece_list_id") ?? "");
    if (!listId) return;

    // Pieces already on the offer — don't double-add.
    const { data: existing } = await db
      .from("offer_items")
      .select("piece_id, sort_order")
      .eq("offer_id", id);
    const have = new Set((existing ?? []).map((r) => r.piece_id as string));
    let nextSort =
      (existing ?? []).reduce((m, r) => Math.max(m, (r.sort_order as number) ?? -1), -1) + 1;

    // Resolve through the shared helper: reading piece_list_items directly
    // returned nothing for a live list, because a live list keeps no rows
    // there — its membership is the saved filters, re-run on read. Adding a
    // live list to an offer silently added zero works.
    const { data: listRow } = await db
      .from("piece_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", listId)
      .maybeSingle();
    if (!listRow) return;

    // resolveListPieceIds throws on a failed read. Uncaught, that replaced
    // the page with the error boundary; now it is a message on the page, and
    // nothing has been added.
    let memberIds: string[];
    try {
      memberIds = await resolveListPieceIds(db, listRow);
    } catch (e) {
      console.error("[offer] list not resolved:", e instanceof Error ? e.message : e);
      redirect(
        `/offers/${id}?error=${encodeURIComponent("The list's works could not be read, so none were added. Try again.")}`,
      );
    }

    const rows = memberIds
      .filter((pid) => pid && !have.has(pid))
      .map((pid) => ({ offer_id: id, piece_id: pid, sort_order: nextSort++ }));

    if (rows.length > 0) {
      const { error } = await db.from("offer_items").insert(rows);
      if (error) {
        console.error("[offer] list works not added:", error.message);
        redirect(`/offers/${id}?error=${encodeURIComponent("The list's works could not be added to the offer. Try again.")}`);
      }
    }
    revalidatePath(`/offers/${id}`);
  }

  // The line editors' writes throw when nothing was saved (an error, or no
  // row of this offer matched), so the row says "Couldn't save" and keeps
  // the change to send again, and a reorder snaps back. They used to resolve
  // either way, and the row showed "Saved" over a price the database never
  // took, which the offer email then went out without.
  async function updateItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const itemId = String(formData.get("item_id") ?? "");
    // parseAmount, not Number(): Number("12,000") is NaN, which was stored as
    // null, so typing a price the way people write it cleared it.
    const { data, error } = await db
      .from("offer_items")
      .update({
        price_override_gbp: parseAmount(formData.get("price_override_gbp")),
        note: String(formData.get("note") ?? "").trim() || null,
      })
      .eq("id", itemId)
      .eq("offer_id", id)
      .select("id");
    if (error || !data?.length) {
      console.error("[offer] line not saved:", error?.message ?? "no row matched");
      throw new Error("The offer line was not saved");
    }
    revalidatePath(`/offers/${id}`);
  }

  // A <form action>: a throw would replace the page with the error boundary,
  // so a failed delete comes back as a message on the page instead.
  async function removeItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { error } = await db
      .from("offer_items")
      .delete()
      .eq("id", String(formData.get("item_id") ?? ""))
      .eq("offer_id", id);
    if (error) {
      console.error("[offer] line not removed:", error.message);
      redirect(`/offers/${id}?error=${encodeURIComponent("The work could not be removed from the offer. Try again.")}`);
    }
    revalidatePath(`/offers/${id}`);
  }

  async function reorderItems(orderedIds: string[]) {
    "use server";
    const db = await getSupabase();
    // Persist the new order as sequential sort_order values.
    const results = await Promise.all(
      orderedIds.map((itemId, i) =>
        db.from("offer_items").update({ sort_order: i }).eq("id", itemId).eq("offer_id", id).select("id"),
      ),
    );
    const failedWrite = results.find((r) => r.error || !r.data?.length);
    if (failedWrite) {
      console.error("[offer] order not saved:", failedWrite.error?.message ?? "no row matched");
      // ReorderGrid puts the old order back when this throws.
      throw new Error("The new order was not saved");
    }
    revalidatePath(`/offers/${id}`);
  }

  async function addRecipient(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const contactId = String(formData.get("contact_id") ?? "");
    if (!contactId) return;
    await db
      .from("offer_recipients")
      .insert({ offer_id: id, contact_id: contactId });
    revalidatePath(`/offers/${id}`);
  }

  async function addListRecipients(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const listId = String(formData.get("list_id") ?? "");
    if (!listId) return;
    const { data: listRow } = await db
      .from("crm_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", listId)
      .maybeSingle();
    if (!listRow) return;
    // Via the shared resolver so a dynamic list contributes its live
    // membership rather than the zero rows it stores.
    const memberIds = await resolveListContactIds(db, listRow);
    const rows = memberIds.map((contactId) => ({
      offer_id: id,
      contact_id: contactId,
    }));
    if (rows.length > 0) {
      // Unique (offer_id, contact_id) makes re-adds no-ops.
      await db.from("offer_recipients").upsert(rows, {
        onConflict: "offer_id,contact_id",
        ignoreDuplicates: true,
      });
    }
    revalidatePath(`/offers/${id}`);
  }

  async function removeRecipient(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db
      .from("offer_recipients")
      .delete()
      .eq("id", String(formData.get("recipient_id") ?? ""));
    revalidatePath(`/offers/${id}`);
  }

  async function sendOffer() {
    "use server";
    // Checked here, not only by the page: a server action can be called on
    // its own, and the send log below is written with the service client.
    const session = await getSession();
    if (!session || !hasRole(session.roles, "admin", "staff")) throw new Error("Forbidden");
    const db = await getSupabase();
    const audit = createServiceClient();

    const { count: itemCount } = await db
      .from("offer_items")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", id);
    if (!itemCount) redirect(`/offers/${id}?sent=noitems`);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) redirect(`/offers/${id}?sent=nokey`);

    const { data: off } = await db
      .from("offers")
      .select("title, intro, expires_at, access_password")
      .eq("id", id)
      .maybeSingle();
    const { data: recs } = await db
      .from("offer_recipients")
      .select(
        "id, token, sent_at, contact:crm_contacts ( first_name, salutation, email, unsubscribed_at, email_bounced_at )",
      )
      .eq("offer_id", id)
      .is("sent_at", null)
      .order("created_at");

    const from =
      process.env.OFFERS_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      `${GALLERY_NAME} <offers@web.joostvandenbergh.com>`;
    const expiresAt = off?.expires_at ? longDate(off.expires_at) : undefined;

    const started = Date.now();
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    let left = 0;
    let unmarked = 0;
    let reason = "";
    for (const r of (recs ?? []) as unknown as Recipient[]) {
      const email = r.contact?.email;
      // No address, unsubscribed, or an address that hard-bounced.
      if (!email || !canEmail(r.contact)) {
        skipped++;
        continue;
      }
      // Near the time limit: the rest wait for the next press of Send.
      if (left > 0 || Date.now() - started > SEND_BUDGET_MS) {
        left++;
        continue;
      }
      const recipientName =
        r.contact?.first_name ?? r.contact?.salutation ?? "collector";
      const props = {
        recipientName,
        offerTitle: off?.title ?? "A selection of works",
        intro: off?.intro ?? undefined,
        offerUrl: `${OFFER_BASE}/o/${r.token}`,
        galleryName: GALLERY_NAME,
        expiresAt,
        accessPassword: off?.access_password ?? undefined,
      };
      const subject = off?.title ?? "A private selection";
      let resendId: string;
      try {
        // The key makes a second press of Send (or two tabs) a no-op at
        // Resend for anyone the first press already reached.
        resendId = await sendEmail(
          apiKey,
          { from, to: email, subject, react: OfferEmail(props) },
          "Offer",
          { idempotencyKey: emailIdempotencyKey(`offer-${r.id}`, { from, to: email, subject, props }) },
        );
      } catch (e) {
        // Refused: sent_at stays empty, so the recipient is still counted as
        // ready to send and pressing Send again retries them. The reason is
        // kept for the recipients table.
        failed++;
        reason ||= emailErrorCode(e);
        await logEmailEvent(
          audit,
          {
            event_type: "failed",
            offer_recipient_id: r.id,
            payload: { error: emailErrorCode(e), message: emailErrorDetail(e) },
          },
          "offer",
        );
        continue;
      }
      // The email went out, so it counts as sent whatever happens next. The
      // mark is what keeps the next Send from mailing this person again, so a
      // failed write is tried once more and then reported on its own.
      const mark = () =>
        db
          .from("offer_recipients")
          .update({
            sent_at: new Date().toISOString(),
            resend_email_id: resendId,
          })
          .eq("id", r.id)
          .select("id");
      let marked = await mark();
      if (marked.error || !marked.data?.length) marked = await mark();
      if (marked.error || !marked.data?.length) {
        unmarked++;
        console.error("[offer] sent but not marked sent:", r.id, marked.error?.message ?? "no row matched");
      }
      await logEmailEvent(
        audit,
        { event_type: "sent", offer_recipient_id: r.id, payload: { resend_id: resendId } },
        "offer",
      );
      sent++;
    }
    revalidatePath(`/offers/${id}`);
    redirect(
      `/offers/${id}?sent=${sent}&skipped=${skipped}${
        failed ? `&failed=${failed}&reason=${encodeURIComponent(reason)}` : ""
      }${left ? `&left=${left}` : ""}${unmarked ? `&unmarked=${unmarked}` : ""}`,
    );
  }

  const expiryValue = offer.expires_at
    ? new Date(offer.expires_at).toISOString().slice(0, 10)
    : "";
  const expired = offer.expires_at != null && new Date(offer.expires_at).getTime() < Date.now();
  const contactName = (c: { first_name: string | null; last_name: string | null } | null) =>
    [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Unnamed";

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/offers", label: "All offers" }}
        title={offer.title}
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            {expired ? <Badge>Expired</Badge> : null}
            <span className="tabular">
              {labelOf(OFFER_KIND_LABELS, offer.kind)} · {formatCount(recipients.length)} recipient
              {recipients.length === 1 ? "" : "s"} · {formatCount(sentCount)} sent
            </span>
          </span>
        }
        actions={
          <SaveToDriveLink
            href={`/api/export/offer-presentation.docx?offer=${id}`}
            className={buttonClass({})}
          >
            Presentation DOCX
          </SaveToDriveLink>
        }
      />

      <div className="space-y-6">
        <FlashNotice searchParams={sp} codes="offer" />

        {/* Settings */}
        <Section title="Details">
          <form action={updateOffer} className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="offer-title" className="label">
                Title
              </label>
              <input id="offer-title" name="title" defaultValue={offer.title} className="field" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="offer-kind" className="label">
                Kind
              </label>
              <select id="offer-kind" name="kind" defaultValue={offer.kind} className="field">
                {Object.entries(OFFER_KIND_LABELS).map(([value, word]) => (
                  <option key={value} value={value}>
                    {word}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="offer-expires" className="label">
                Expires
              </label>
              <input id="offer-expires" type="date" name="expires_at" defaultValue={expiryValue} className="field" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 self-end text-[13px] leading-[1.45] text-ink sm:h-[var(--jvb-control-h)]">
              <input type="checkbox" name="show_prices" defaultChecked={offer.show_prices} className="h-4 w-4 shrink-0" />
              Show prices on the public page
            </label>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="offer-password" className="label">
                Access password <span className="font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="offer-password"
                name="access_password"
                defaultValue={offer.access_password ?? ""}
                className="field"
                placeholder="Leave empty for no password"
                autoComplete="off"
                aria-describedby="offer-password-hint"
              />
              <p id="offer-password-hint" className="text-[12px] leading-[1.4] text-meta">
                When set, the private page asks for this before showing the works. It’s included in the invitation
                email, and clients can request a temporary sign-in link instead.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
              <label htmlFor="offer-intro" className="label">
                Introduction (personalised greeting)
              </label>
              <textarea
                id="offer-intro"
                name="intro"
                rows={3}
                defaultValue={offer.intro ?? ""}
                className="field"
                placeholder="We have set aside the following works, which we thought would be of particular interest…"
              />
            </div>
            <div className="sm:col-span-2">
              {/* Secondary: Send, below, is the page's one primary action. */}
              <Button type="submit" pendingLabel="Saving…">
                Save details
              </Button>
            </div>
          </form>
        </Section>

        {/* Works */}
        <Section title={<SectionCount title="Works" n={items.length} />}>
          <OfferItemsEditor
            items={items}
            updateItem={updateItem}
            removeItem={removeItem}
            reorderItems={reorderItems}
          />

          {/* Add works */}
          <form method="get" role="search" className="mt-4 flex flex-wrap items-end gap-2">
            {rcQ ? <input type="hidden" name="rc" value={rcQ} /> : null}
            <div className="flex w-full min-w-0 max-w-md flex-col gap-1">
              <label htmlFor="offer-add-works" className="label">
                Find works to add
              </label>
              <input
                id="offer-add-works"
                type="search"
                name="add"
                defaultValue={addQ}
                placeholder="Stock no., title, maker…"
                className="field"
              />
            </div>
            <Button type="submit" icon={<SearchIcon size={14} />}>
              Search
            </Button>
          </form>
          {/* Nothing matched exactly: these are the typo-tolerant search's. */}
          {addQ && workResults.length > 0 && workPick?.similar ? <p className="label mt-3">Similar matches</p> : null}
          {addQ ? (
            workResults.length > 0 ? (
              <ul className={`${workPick?.similar ? "mt-1.5" : "mt-3"} border-t border-rule`}>
                {workResults.map((w) => (
                  <li key={w.id} className="border-b border-rule">
                    <form action={addItem} className="flex items-center justify-between gap-3 py-2">
                      <input type="hidden" name="piece_id" value={w.id} />
                      <span className="min-w-0 text-[13px] leading-[1.45] text-ink">
                        <span className="tabular text-meta">{w.stock_number ?? "—"}</span> {w.title ?? "Untitled"}
                      </span>
                      <Button
                        type="submit"
                        size="sm"
                        pendingLabel="Adding…"
                        icon={<PlusIcon size={14} />}
                        aria-label={`Add ${w.stock_number ?? w.title ?? "this work"}`}
                      >
                        Add
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] leading-[1.45] text-body">
                No works match “{addQ}” that are not already on the offer.
              </p>
            )
          ) : null}

          {/* Add every work from a saved inventory list */}
          {(pieceLists ?? []).length > 0 ? (
            <form action={addListItems} className="mt-4 flex flex-wrap items-end gap-2 border-t border-rule pt-4">
              <div className="flex w-full min-w-0 max-w-md flex-col gap-1">
                <label htmlFor="offer-add-list" className="label">
                  Add works from a list
                </label>
                <select id="offer-add-list" name="piece_list_id" defaultValue="" required className="field">
                  <option value="" disabled>
                    Choose an inventory list…
                  </option>
                  {/* "—" when a list's size could not be read (countListMembers gives null). */}
                  {listOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.count ?? "—"}){l.isDynamic ? " · live" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" pendingLabel="Adding…">
                Add all
              </Button>
            </form>
          ) : null}
        </Section>

        {/* Recipients */}
        <Section title={<SectionCount title="Recipients" n={recipients.length} />}>
          <TableFrame>
            <Table className="min-w-[640px]">
              <thead>
                <tr>
                  <Th>Contact</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th numeric>Views</Th>
                  <Th className="w-24">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => {
                  const failure = r.sent_at ? undefined : sendFailures.get(r.id);
                  const state = recipientState(r, failure);
                  const note = replyNotes.get(r.id);
                  return (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap text-ink">
                        {r.contact?.id ? (
                          <Link href={`/crm/contacts/${r.contact.id}`} className="link-plain font-medium">
                            {contactName(r.contact)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-body">
                        {r.contact?.email ?? "—"}
                        {r.contact?.unsubscribed_at ? (
                          <span className="ml-1 text-[12px] text-meta">(unsubscribed)</span>
                        ) : r.contact?.email_bounced_at ? (
                          // Not mailed: a new address on the contact clears it.
                          <span className="ml-1 text-[12px] text-meta">(bounced {formatDate(r.contact.email_bounced_at)})</span>
                        ) : null}
                      </Td>
                      <Td className="min-w-[220px]">
                        <Badge variant="dot" tone={state.tone} hollow={state.hollow}>
                          {state.word}
                          {r.response && r.responded_at ? `, ${formatDate(r.responded_at)}` : null}
                        </Badge>
                        {note ? (
                          <p className="mt-0.5 max-w-[360px] whitespace-pre-line text-[12px] leading-[1.4] text-body">
                            “{note}”
                          </p>
                        ) : null}
                      </Td>
                      <Td numeric className="text-body">
                        {formatCount(r.view_count ?? 0)}
                      </Td>
                      <Td className="py-0 text-right">
                        <form action={removeRecipient}>
                          <input type="hidden" name="recipient_id" value={r.id} />
                          <Button
                            type="submit"
                            variant="quiet"
                            size="sm"
                            pendingLabel="Removing…"
                            aria-label={`Remove ${contactName(r.contact)} from this offer`}
                          >
                            Remove
                          </Button>
                        </form>
                      </Td>
                    </Tr>
                  );
                })}
                {recipients.length === 0 ? (
                  <EmptyRow colSpan={5}>No recipients yet. Add a contact list or find contacts below.</EmptyRow>
                ) : null}
              </tbody>
            </Table>
          </TableFrame>

          {/* Add recipients */}
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
            <form action={addListRecipients} className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <div className="flex w-full min-w-0 flex-col gap-1 sm:w-64">
                <label htmlFor="offer-add-contact-list" className="label">
                  Add a contact list
                </label>
                <select id="offer-add-contact-list" name="list_id" defaultValue="" className="field">
                  <option value="" disabled>
                    Choose a list…
                  </option>
                  {(lists ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" pendingLabel="Adding…">
                Add list
              </Button>
            </form>

            <form method="get" role="search" className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              {addQ ? <input type="hidden" name="add" value={addQ} /> : null}
              <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
                <label htmlFor="offer-find-contacts" className="label">
                  Find contacts to add
                </label>
                <input
                  id="offer-find-contacts"
                  type="search"
                  name="rc"
                  defaultValue={rcQ}
                  placeholder="Name or email"
                  className="field"
                />
              </div>
              <Button type="submit" icon={<SearchIcon size={14} />}>
                Search
              </Button>
            </form>
          </div>
          {rcQ && contactResults.length > 0 && contactPick?.similar ? <p className="label mt-3">Similar matches</p> : null}
          {rcQ ? (
            contactResults.length > 0 ? (
              <ul className={`${contactPick?.similar ? "mt-1.5" : "mt-3"} border-t border-rule`}>
                {contactResults.map((c) =>
                  c ? (
                    <li key={c.id} className="border-b border-rule">
                      <form action={addRecipient} className="flex items-center justify-between gap-3 py-2">
                        <input type="hidden" name="contact_id" value={c.id} />
                        <span className="min-w-0 text-[13px] leading-[1.45] text-ink">
                          {contactName(c)}
                          <span className="ml-2 text-[12px] text-meta">{c.email ?? "no email"}</span>
                        </span>
                        <Button
                          type="submit"
                          size="sm"
                          pendingLabel="Adding…"
                          icon={<PlusIcon size={14} />}
                          aria-label={`Add ${contactName(c)}`}
                        >
                          Add
                        </Button>
                      </form>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] leading-[1.45] text-body">
                No contacts match “{rcQ}” who are not already recipients.
              </p>
            )
          ) : null}
        </Section>

        {/* Send */}
        <Section
          title="Send private links"
          meta={
            sendable > 0
              ? `${sendable} recipient${sendable === 1 ? "" : "s"} ready to send (unsent, with an email address that has not bounced or unsubscribed).`
              : "No unsent recipients with an email address that can be mailed."
          }
          actions={
            <form action={sendOffer}>
              <Button
                type="submit"
                variant="primary"
                pendingLabel="Sending…"
                disabled={sendable === 0 || items.length === 0}
                icon={<MailIcon size={14} />}
              >
                Send to {sendable}
              </Button>
            </form>
          }
        />
      </div>
    </div>
  );
}

/** A section heading with its count beside it, as the page always showed. */
function SectionCount({ title, n }: { title: string; n: number }) {
  return (
    <>
      {title} <span className="tabular font-normal text-meta">{formatCount(n)}</span>
    </>
  );
}
