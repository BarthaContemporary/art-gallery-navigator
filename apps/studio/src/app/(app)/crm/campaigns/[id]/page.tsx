import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { Resend } from "resend";
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

export const metadata = { title: "Newsletter" };

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
};

type ListLite = { id: string; name: string; crm_list_members: { count: number }[] };

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
  searchParams: Promise<{ sent?: string; skipped?: string; test?: string; err?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await getSupabase();

  const { data: campaignRow } = await supabase
    .from("crm_campaigns")
    .select(
      "id, name, subject, preview_text, from_address, list_id, design, body_html, status, sent_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!campaignRow) notFound();
  const campaign = campaignRow as Campaign;
  const design = campaign.design ?? emptyDesign();

  const { data: listData } = await supabase
    .from("crm_lists")
    .select("id, name, crm_list_members(count)")
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
    const resend = new Resend(apiKey);
    try {
      await resend.emails.send({
        from: cc?.from_address || DEFAULT_FROM,
        to,
        subject: `[TEST] ${cc?.subject ?? "Newsletter"}`,
        html,
      });
    } catch {
      redirect(`/crm/campaigns/${id}?err=testfail`);
    }
    redirect(`/crm/campaigns/${id}?test=${encodeURIComponent(to)}`);
  }

  // ---- send to the whole list ---------------------------------------------
  async function sendCampaign() {
    "use server";
    const db = await getSupabase();

    const { data: c } = await db
      .from("crm_campaigns")
      .select("subject, from_address, list_id, design, preview_text, status")
      .eq("id", id)
      .maybeSingle();
    const cc = c as
      | (Pick<Campaign, "subject" | "from_address" | "list_id" | "design" | "preview_text"> & {
          status: string;
        })
      | null;
    if (!cc) redirect(`/crm/campaigns/${id}?err=missing`);
    if (cc!.status === "sent") redirect(`/crm/campaigns/${id}?err=already`);
    if (!cc!.list_id) redirect(`/crm/campaigns/${id}?err=nolist`);
    if (!cc!.subject) redirect(`/crm/campaigns/${id}?err=nosubject`);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) redirect(`/crm/campaigns/${id}?err=nokey`);

    const { data: members } = await db
      .from("crm_list_members")
      .select(
        "contact:crm_contacts ( id, first_name, salutation, email, marketing_consent, do_not_mail, unsubscribed_at )",
      )
      .eq("list_id", cc!.list_id);
    const contacts = (members ?? [])
      .map((m) => (m as unknown as { contact: MemberContact | null }).contact)
      .filter(Boolean) as MemberContact[];
    const eligible = contacts.filter(
      (c2) => c2.email && c2.marketing_consent && !c2.do_not_mail && !c2.unsubscribed_at,
    );

    const compiled = compileNewsletter(cc!.design ?? emptyDesign(), {
      galleryName: GALLERY_NAME,
      galleryAddress: GALLERY_ADDRESS,
      previewText: cc!.preview_text ?? undefined,
    });
    const resend = new Resend(apiKey);
    const from = cc!.from_address || DEFAULT_FROM;
    let sent = 0;
    let skipped = contacts.length - eligible.length;

    for (const contact of eligible) {
      const unsubscribeUrl = await unsubscribeUrlFor(db, contact.id);
      const html = personalise(compiled, {
        salutation: salutationFor(contact),
        unsubscribeUrl,
      });
      try {
        const { data: res } = await resend.emails.send({
          from,
          to: contact.email as string,
          subject: cc!.subject as string,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        const { data: recRow } = await db
          .from("crm_campaign_recipients")
          .upsert(
            {
              campaign_id: id,
              contact_id: contact.id,
              resend_email_id: res?.id ?? null,
              status: "sent",
            },
            { onConflict: "campaign_id,contact_id" },
          )
          .select("id")
          .single();
        await db.from("email_events").insert({
          event_type: "sent",
          campaign_recipient_id: (recRow as { id: string } | null)?.id ?? null,
          payload: { resend_id: res?.id ?? null },
        });
        sent++;
      } catch {
        skipped++;
      }
    }

    await db
      .from("crm_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    revalidatePath(`/crm/campaigns/${id}`);
    redirect(`/crm/campaigns/${id}?sent=${sent}&skipped=${skipped}`);
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
    const total = rows.length;
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
          <span className="rounded-full bg-oranje/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-oranje">
            Sent
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-muted">
          {campaign.subject} · sent{" "}
          {campaign.sent_at
            ? new Date(campaign.sent_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Recipients", String(total)],
            ["Opened", stat(opened)],
            ["Clicked", stat(clicked)],
            ["Bounced", stat(bounced)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[11px] border border-line bg-cell p-4">
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
              className="h-[600px] w-full rounded-[11px] border border-line bg-white"
            />
          </div>
        ) : null}
      </div>
    );
  }

  // ---- draft view: the designer -------------------------------------------
  const banner =
    sp.sent !== undefined
      ? `Sent to ${sp.sent} recipient${sp.sent === "1" ? "" : "s"}${
          sp.skipped && sp.skipped !== "0" ? ` · ${sp.skipped} skipped (no consent / no email)` : ""
        }.`
      : sp.test
        ? `Test sent to ${sp.test}.`
        : sp.err === "nokey"
          ? "No RESEND_API_KEY configured — set it to send."
          : sp.err === "nolist"
            ? "Choose an audience list before sending."
            : sp.err === "nosubject"
              ? "Add a subject line before sending."
              : sp.err === "testfail"
                ? "Test send failed — check the From address and API key."
                : sp.err === "already"
                  ? "This newsletter has already been sent."
                  : null;

  const selectedList = lists.find((l) => l.id === campaign.list_id);
  const audienceCount = selectedList?.crm_list_members?.[0]?.count ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/crm/campaigns" className="text-[12.5px] text-ink-soft">
          ← All newsletters
        </Link>
        <div className="flex items-center gap-2">
          <form action={sendTest} className="flex items-center gap-2">
            <input
              type="email"
              name="test_email"
              placeholder="you@gallery.com"
              className="w-48 rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[12.5px]"
            />
            <button
              type="submit"
              className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid hover:text-ink-strong"
            >
              Send test
            </button>
          </form>
          <form action={sendCampaign}>
            <button
              type="submit"
              className="rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg disabled:opacity-50"
              disabled={!campaign.list_id}
              title={
                campaign.list_id
                  ? `Send to ${audienceCount} recipient${audienceCount === 1 ? "" : "s"}`
                  : "Choose an audience first"
              }
            >
              Send to list{campaign.list_id ? ` (${audienceCount})` : ""}
            </button>
          </form>
        </div>
      </div>

      {banner ? (
        <p className="mt-3 rounded-lg border border-line-control bg-control px-3 py-2 text-[12.5px] text-ink-body">
          {banner}
        </p>
      ) : null}

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
          count: l.crm_list_members?.[0]?.count ?? 0,
        }))}
        defaultFrom={DEFAULT_FROM}
        galleryName={GALLERY_NAME}
        galleryAddress={GALLERY_ADDRESS}
      />
    </div>
  );
}
