import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { emptyDesign } from "@/lib/newsletter";

export const metadata = { title: "Newsletters" };

type CampaignRow = {
  id: string;
  name: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  updated_at: string | null;
  crm_campaign_recipients: { count: number }[];
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <form action={newCampaign}>
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg"
          >
            New newsletter
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Subject</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Recipients</th>
              <th className="px-4 py-2.5 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const sent = c.status === "sent";
              const count = c.crm_campaign_recipients?.[0]?.count ?? 0;
              return (
                <tr key={c.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                  <td className="px-4 py-2.5 text-ink-body">
                    <Link href={`/crm/campaigns/${c.id}`} className="hover:text-oranje">
                      {c.name}
                    </Link>
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-ink-muted">
                    {c.subject || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${
                        sent
                          ? "bg-oranje/10 text-oranje"
                          : "border border-line-control text-ink-soft"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                    {sent ? count : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                    {sent ? `sent ${fmt(c.sent_at)}` : fmt(c.updated_at)}
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  No newsletters yet — create one to design and send a mailing.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
