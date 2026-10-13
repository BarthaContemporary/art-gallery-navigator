import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { emptyDesign } from "@/lib/newsletter";
import { formatCount, formatDate } from "@/lib/format";
import { labelOf, type Tone } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Newsletters" };

/** crm_campaigns.status, as the send writes it (crm/campaigns/[id]). */
const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sending: "Sending",
  partial: "Part-sent",
  sent: "Sent",
};

/**
 * Marked only where a newsletter needs someone: one being sent (info) or one
 * that stopped part way and waits for Resume (warn). Draft and sent are
 * resting states and stay neutral; sent is no longer the accent.
 */
const CAMPAIGN_STATUS_TONES: Record<string, Tone> = {
  sending: "info",
  partial: "warn",
};

type CampaignRow = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  updated_at: string | null;
  crm_campaign_recipients: { count: number }[];
};

// "12 Oct 2026", the London day. This page renders on the server (UTC), so a
// send just after midnight in summer used to show the day before.
function fmt(d: string | null) {
  return formatDate(d, "short");
}

export default async function CampaignsPage() {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("crm_campaigns")
    .select("id, name, subject, status, sent_at, updated_at, crm_campaign_recipients(count)")
    .order("updated_at", { ascending: false });
  const campaigns = (data ?? []) as unknown as CampaignRow[];

  async function newCampaign() {
    "use server";
    const db = await getSupabase();
    const { data: created } = await db
      .from("crm_campaigns")
      .insert({
        name: "Untitled newsletter",
        status: "draft",
        design: emptyDesign(),
      })
      .select("id")
      .single();
    if (created) redirect(`/crm/campaigns/${created.id}`);
    redirect("/crm/campaigns");
  }

  const newButton = (size: "md" | "sm" = "md") => (
    <form action={newCampaign}>
      <Button type="submit" variant={size === "md" ? "primary" : "secondary"} size={size} pendingLabel="Creating…">
        New newsletter
      </Button>
    </form>
  );

  return (
    <div>
      <PageHeader
        title="Newsletters"
        meta={
          <span className="tabular">{`${formatCount(campaigns.length)} ${
            campaigns.length === 1 ? "newsletter" : "newsletters"
          }`}</span>
        }
        actions={newButton()}
      />

      {/* relative: the frame contains the sr-only head words, which
          otherwise sit outside the scroll and widen a phone page. */}
      <TableFrame className="relative">
        <Table className="min-w-[640px]">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
              <Th numeric>Recipients</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const sent = c.status === "sent";
              const count = c.crm_campaign_recipients?.[0]?.count ?? 0;
              return (
                <Tr key={c.id}>
                  {/* A floor under the name, so on a phone the table scrolls
                      sideways rather than stacking a name one word a line. */}
                  <Td className="min-w-[12rem]">
                    <Link href={`/crm/campaigns/${c.id}`} className="link-plain font-medium text-ink">
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="max-w-[280px] truncate text-body">{c.subject || "—"}</Td>
                  <Td>
                    <Badge variant="dot" tone={CAMPAIGN_STATUS_TONES[c.status] ?? "neutral"} hollow={c.status === "draft"}>
                      {labelOf(CAMPAIGN_STATUS_LABELS, c.status)}
                    </Badge>
                  </Td>
                  <Td numeric className="text-body">
                    {sent ? formatCount(count) : "—"}
                  </Td>
                  <Td className="tabular whitespace-nowrap text-body">
                    {sent ? `Sent ${fmt(c.sent_at)}` : fmt(c.updated_at)}
                  </Td>
                </Tr>
              );
            })}
            {campaigns.length === 0 ? (
              <EmptyRow colSpan={5} action={newButton("sm")}>
                No newsletters yet. Create one to design and send a mailing.
              </EmptyRow>
            ) : null}
          </tbody>
        </Table>
      </TableFrame>
    </div>
  );
}
