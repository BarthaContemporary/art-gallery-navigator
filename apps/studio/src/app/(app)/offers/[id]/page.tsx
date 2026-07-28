import { SaveToDriveLink } from "@/components/save-to-drive";
import { SubmitButton } from "@/components/submit-button";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Resend } from "resend";
import { OfferEmail } from "@jvb/emails";
import { getSupabase } from "@/lib/supabase";
import { sanitizeFilterTerm } from "@/lib/search";
import { OfferItemsEditor } from "@/components/offer-items-editor";
import { resolveListPieceIds, countListMembers, type ListRules } from "@/lib/list-members";

export const metadata = { title: "Offer" };

// Where the tokenized public offer pages live (the web app).
const OFFER_BASE =
  process.env.OFFER_LINK_BASE_URL ?? "https://jvb-web.vercel.app";
const GALLERY_NAME = "Joost van den Bergh";

const gbp = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(n);

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
  } | null;
};

const fieldCls =
  "mt-1 block w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";
const labelCls =
  "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const btnGhost =
  "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";

export default async function OfferDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string; rc?: string; sent?: string; skipped?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();

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
        "id, price_override_gbp, note, sort_order, piece:pieces ( id, stock_number, title, medium, period, status )",
      )
      .eq("offer_id", id)
      .order("sort_order", { nullsFirst: true }),
    supabase
      .from("offer_recipients")
      .select(
        "id, token, sent_at, first_viewed_at, view_count, response, responded_at, contact:crm_contacts ( id, first_name, last_name, salutation, email, unsubscribed_at )",
      )
      .eq("offer_id", id)
      .order("created_at"),
    supabase.from("crm_lists").select("id, name").order("name"),
    supabase
      .from("piece_lists")
      .select("id, name, is_dynamic, filter_rules, piece_list_items(count)")
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

  const items = (itemsData ?? []) as unknown as Item[];
  const recipients = (recipientsData ?? []) as unknown as Recipient[];
  const existingPieceIds = new Set(items.map((i) => i.piece?.id).filter(Boolean));
  const existingContactIds = new Set(
    recipients.map((r) => r.contact?.id).filter(Boolean),
  );

  // Add-works search (ranked pieces_search), excluding pieces already added.
  const addQ = (sp.add ?? "").trim();
  let workResults: PieceLite[] = [];
  if (addQ) {
    const { data: hits } = await supabase.rpc("pieces_search", { q: addQ });
    workResults = ((hits ?? []) as PieceLite[])
      .filter((h) => !existingPieceIds.has(h.id))
      .slice(0, 20);
  }

  // Add-recipient contact search.
  const rcQ = sanitizeFilterTerm((sp.rc ?? "").trim());
  let contactResults: Recipient["contact"][] = [];
  if (rcQ) {
    const { data: cs } = await supabase
      .from("crm_contacts")
      .select("id, first_name, last_name, salutation, email, unsubscribed_at")
      .or(
        `first_name.ilike.%${rcQ}%,last_name.ilike.%${rcQ}%,email.ilike.%${rcQ}%`,
      )
      .limit(20);
    contactResults = ((cs ?? []) as Recipient["contact"][]).filter(
      (c) => c && !existingContactIds.has(c.id),
    );
  }

  const sentCount = recipients.filter((r) => r.sent_at).length;
  const sendable = recipients.filter(
    (r) => !r.sent_at && r.contact?.email && !r.contact?.unsubscribed_at,
  ).length;

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

    const memberIds = await resolveListPieceIds(db, listRow);

    const rows = memberIds
      .filter((pid) => pid && !have.has(pid))
      .map((pid) => ({ offer_id: id, piece_id: pid, sort_order: nextSort++ }));

    if (rows.length > 0) {
      await db.from("offer_items").insert(rows);
    }
    revalidatePath(`/offers/${id}`);
  }

  async function updateItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const itemId = String(formData.get("item_id") ?? "");
    const priceRaw = String(formData.get("price_override_gbp") ?? "").trim();
    await db
      .from("offer_items")
      .update({
        price_override_gbp: priceRaw ? Number(priceRaw) : null,
        note: String(formData.get("note") ?? "").trim() || null,
      })
      .eq("id", itemId);
    revalidatePath(`/offers/${id}`);
  }

  async function removeItem(formData: FormData) {
    "use server";
    const db = await getSupabase();
    await db.from("offer_items").delete().eq("id", String(formData.get("item_id") ?? ""));
    revalidatePath(`/offers/${id}`);
  }

  async function reorderItems(orderedIds: string[]) {
    "use server";
    const db = await getSupabase();
    // Persist the new order as sequential sort_order values.
    await Promise.all(
      orderedIds.map((itemId, i) =>
        db.from("offer_items").update({ sort_order: i }).eq("id", itemId).eq("offer_id", id),
      ),
    );
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
    const { data: members } = await db
      .from("crm_list_members")
      .select("contact_id")
      .eq("list_id", listId);
    const rows = (members ?? []).map((m) => ({
      offer_id: id,
      contact_id: m.contact_id as string,
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
    const db = await getSupabase();

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
        "id, token, sent_at, contact:crm_contacts ( first_name, salutation, email, unsubscribed_at )",
      )
      .eq("offer_id", id)
      .is("sent_at", null);

    const resend = new Resend(apiKey);
    const from =
      process.env.OFFERS_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      `${GALLERY_NAME} <offers@web.joostvandenbergh.com>`;
    const expiresAt = off?.expires_at ? longDate(off.expires_at) : undefined;

    let sent = 0;
    let skipped = 0;
    for (const r of (recs ?? []) as unknown as Recipient[]) {
      const email = r.contact?.email;
      if (!email || r.contact?.unsubscribed_at) {
        skipped++;
        continue;
      }
      const recipientName =
        r.contact?.first_name ?? r.contact?.salutation ?? "collector";
      try {
        const { data: res } = await resend.emails.send({
          from,
          to: email,
          subject: off?.title ?? "A private selection",
          react: OfferEmail({
            recipientName,
            offerTitle: off?.title ?? "A selection of works",
            intro: off?.intro ?? undefined,
            offerUrl: `${OFFER_BASE}/o/${r.token}`,
            galleryName: GALLERY_NAME,
            expiresAt,
            accessPassword: off?.access_password ?? undefined,
          }),
        });
        await db
          .from("offer_recipients")
          .update({
            sent_at: new Date().toISOString(),
            resend_email_id: res?.id ?? null,
          })
          .eq("id", r.id);
        await db
          .from("email_events")
          .insert({
            event_type: "sent",
            offer_recipient_id: r.id,
            payload: { resend_id: res?.id ?? null },
          });
        sent++;
      } catch {
        skipped++;
      }
    }
    revalidatePath(`/offers/${id}`);
    redirect(`/offers/${id}?sent=${sent}&skipped=${skipped}`);
  }

  // ---- send banner --------------------------------------------------------
  let banner: string | null = null;
  if (sp.sent === "nokey")
    banner = "No RESEND_API_KEY configured — set it to send offers.";
  else if (sp.sent === "noitems")
    banner = "Add at least one work before sending.";
  else if (sp.sent)
    banner = `Sent ${sp.sent} email${sp.sent === "1" ? "" : "s"}${
      sp.skipped && sp.skipped !== "0" ? ` · ${sp.skipped} skipped` : ""
    }.`;

  const expiryValue = offer.expires_at
    ? new Date(offer.expires_at).toISOString().slice(0, 10)
    : "";

  return (
    <div className="max-w-[1000px]">
      <Link href="/offers" className="text-[12.5px] text-ink-soft">
        ← All offers
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[26px] font-semibold text-ink-strong">
          {offer.title}
        </h1>
        <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
          {offer.kind.replace(/_/g, " ")} · {recipients.length} recipient
          {recipients.length === 1 ? "" : "s"} · {sentCount} sent
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[12px]">
        <SaveToDriveLink
          href={`/api/export/offer-presentation.docx?offer=${id}`}
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 font-medium text-ink-mid hover:text-ink-strong"
        >
          Presentation DOCX
        </SaveToDriveLink>
      </div>

      {banner ? (
        <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
          {banner}
        </p>
      ) : null}

      {/* Settings */}
      <form
        action={updateOffer}
        className="mt-6 grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-2"
      >
        <label className={labelCls}>
          Title
          <input name="title" defaultValue={offer.title} className={fieldCls} />
        </label>
        <label className={labelCls}>
          Kind
          <select name="kind" defaultValue={offer.kind} className={fieldCls}>
            <option value="offer">Offer</option>
            <option value="fair_preview">Fair preview</option>
            <option value="viewing_room">Viewing room</option>
          </select>
        </label>
        <label className={labelCls}>
          Expires
          <input
            type="date"
            name="expires_at"
            defaultValue={expiryValue}
            className={fieldCls}
          />
        </label>
        <label className={`${labelCls} flex items-end gap-2`}>
          <input
            type="checkbox"
            name="show_prices"
            defaultChecked={offer.show_prices}
            className="mb-2"
          />
          <span className="mb-1.5 normal-case tracking-normal text-[12.5px] text-ink-body">
            Show prices on the public page
          </span>
        </label>
        <label className={labelCls}>
          Access password (optional)
          <input
            name="access_password"
            defaultValue={offer.access_password ?? ""}
            className={fieldCls}
            placeholder="leave blank for no password"
            autoComplete="off"
          />
          <span className="mt-1 block text-[11px] normal-case tracking-normal text-ink-soft">
            When set, the private page asks for this before showing the works. It’s included
            in the invitation email, and clients can request a temporary sign-in link instead.
          </span>
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Introduction (personalised greeting)
          <textarea
            name="intro"
            rows={3}
            defaultValue={offer.intro ?? ""}
            className={fieldCls}
            placeholder="We have set aside the following works, which we thought would be of particular interest…"
          />
        </label>
        <div className="sm:col-span-2">
          <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
        </div>
      </form>

      {/* Works */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink-strong">
          Works ({items.length})
        </h2>
        <OfferItemsEditor
          items={items}
          updateItem={updateItem}
          removeItem={removeItem}
          reorderItems={reorderItems}
        />

        {/* Add works */}
        <form method="get" className="mt-4 flex items-center gap-2">
          {rcQ ? <input type="hidden" name="rc" value={rcQ} /> : null}
          <input
            type="search"
            name="add"
            defaultValue={addQ}
            placeholder="Search works to add — stock no., title, maker…"
            className="w-full max-w-md rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
          />
          <button type="submit" className={btnGhost}>
            Search
          </button>
        </form>
        {addQ ? (
          <div className="mt-2 space-y-1">
            {workResults.map((w) => (
              <form
                key={w.id}
                action={addItem}
                className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
              >
                <input type="hidden" name="piece_id" value={w.id} />
                <span className="text-[13px] text-ink-body">
                  <span className="font-mono text-[12px] text-ink-muted">
                    {w.stock_number ?? "—"}
                  </span>{" "}
                  {w.title ?? "Untitled"}
                </span>
                <button type="submit" className={btnGhost}>
                  Add
                </button>
              </form>
            ))}
            {workResults.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted">No matches.</p>
            ) : null}
          </div>
        ) : null}

        {/* Add every work from a saved inventory list */}
        {(pieceLists ?? []).length > 0 ? (
          <form action={addListItems} className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
            <span className="text-[12px] text-ink-muted">Add works from a list</span>
            <select
              name="piece_list_id"
              defaultValue=""
              required
              className="rounded-lg border border-line-control bg-control px-2.5 py-2 text-[13px] text-ink-body"
            >
              <option value="" disabled>
                Choose an inventory list…
              </option>
              {listOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.count}){l.isDynamic ? " · live" : ""}
                </option>
              ))}
            </select>
            <button type="submit" className={btnGhost}>
              Add all
            </button>
          </form>
        ) : null}
      </section>

      {/* Recipients */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink-strong">
          Recipients ({recipients.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
          <table className="w-full min-w-[640px] bg-cell text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Views</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => {
                const name =
                  [r.contact?.first_name, r.contact?.last_name]
                    .filter(Boolean)
                    .join(" ") || "—";
                const status = r.response
                  ? r.response
                  : r.first_viewed_at
                    ? "viewed"
                    : r.sent_at
                      ? "sent"
                      : "not sent";
                return (
                  <tr key={r.id} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2 text-ink-body">{name}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {r.contact?.email ?? "—"}
                      {r.contact?.unsubscribed_at ? (
                        <span className="ml-1 text-[11px] text-ink-soft">
                          (unsubscribed)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{status}</td>
                    <td className="px-4 py-2 font-mono text-[12px] text-ink-muted">
                      {r.view_count ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={removeRecipient}>
                        <input type="hidden" name="recipient_id" value={r.id} />
                        <button
                          type="submit"
                          className="text-[12px] text-ink-soft hover:text-ink-strong"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                    No recipients yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Add recipients */}
        <div className="mt-4 flex flex-wrap items-start gap-6">
          <form action={addListRecipients} className="flex items-center gap-2">
            <select
              name="list_id"
              defaultValue=""
              className="rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
            >
              <option value="" disabled>
                Add a contact list…
              </option>
              {(lists ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button type="submit" className={btnGhost}>
              Add list
            </button>
          </form>

          <form method="get" className="flex items-center gap-2">
            {addQ ? <input type="hidden" name="add" value={addQ} /> : null}
            <input
              type="search"
              name="rc"
              defaultValue={rcQ}
              placeholder="Search contacts by name or email…"
              className="w-72 rounded-lg border border-line-control bg-control px-3 py-2 text-[13px]"
            />
            <button type="submit" className={btnGhost}>
              Search
            </button>
          </form>
        </div>
        {rcQ ? (
          <div className="mt-2 space-y-1">
            {contactResults.map((c) =>
              c ? (
                <form
                  key={c.id}
                  action={addRecipient}
                  className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
                >
                  <input type="hidden" name="contact_id" value={c.id} />
                  <span className="text-[13px] text-ink-body">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      "Unnamed"}
                    <span className="ml-2 text-[12px] text-ink-soft">
                      {c.email ?? "no email"}
                    </span>
                  </span>
                  <button type="submit" className={btnGhost}>
                    Add
                  </button>
                </form>
              ) : null,
            )}
            {contactResults.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted">No matches.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Send */}
      <section className="mt-8 rounded-[11px] border border-line bg-band p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-strong">
              Send private links
            </h2>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {sendable > 0
                ? `${sendable} recipient${sendable === 1 ? "" : "s"} ready to send (unsent, with an email address).`
                : "No unsent recipients with an email address."}
            </p>
          </div>
          <form action={sendOffer}>
            <SubmitButton pendingLabel="Sending…" disabled={sendable === 0 || items.length === 0}>
              Send to {sendable}
            </SubmitButton>
          </form>
        </div>
      </section>
    </div>
  );
}
