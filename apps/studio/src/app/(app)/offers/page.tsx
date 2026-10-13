import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
// London dates: this page renders on the server, where the zone is UTC.
import { formatCount, formatDate } from "@/lib/format";
import { OFFER_KIND_LABELS, labelOf } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Offers" };

export default async function OffersPage() {
  const supabase = await getSupabase();
  const { data: offers } = await supabase
    .from("offers")
    .select(
      "id, title, kind, expires_at, created_at, offer_items(count), offer_recipients(sent_at)",
    )
    .order("created_at", { ascending: false });

  // Lifecycle is derived (no status column): draft until any recipient is
  // sent, then sent; past its expiry it reads expired.
  function lifecycle(o: {
    expires_at: string | null;
    offer_recipients: { sent_at: string | null }[];
  }): { state: "draft" | "sent" | "expired"; label: string; sent: number } {
    const recs = o.offer_recipients ?? [];
    const sent = recs.filter((r) => r.sent_at).length;
    const expired = o.expires_at != null && new Date(o.expires_at).getTime() < Date.now();
    if (expired) return { state: "expired", label: "Expired", sent };
    if (sent > 0) return { state: "sent", label: `Sent to ${formatCount(sent)}`, sent };
    return { state: "draft", label: "Draft", sent };
  }

  async function createOffer(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("offers").insert({
      title,
      kind: String(formData.get("kind") ?? "offer"),
      show_prices: formData.get("show_prices") === "on",
      created_by: user?.id,
    });
    revalidatePath("/offers");
  }

  async function deleteOffer(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    // offer_items / offer_recipients / offer_views cascade on delete.
    await supabase.from("offers").delete().eq("id", id);
    revalidatePath("/offers");
  }

  const count = (v: unknown) => (v as { count: number }[])[0]?.count ?? 0;

  const rows = offers ?? [];

  return (
    <div>
      <PageHeader
        title="Offers"
        meta={<span className="tabular">{`${formatCount(rows.length)} ${rows.length === 1 ? "offer" : "offers"}`}</span>}
      >
        <p className="max-w-[var(--jvb-measure)] text-[13px] leading-[1.45] text-body">
          Private pages sent to collectors by a personal link: offers, art fair previews and viewing rooms.
        </p>
      </PageHeader>

      <div className="space-y-6">
        <Section title="New offer" meta="Create a draft, then open it to add works, choose recipients and send the links.">
          <form action={createOffer} className="flex flex-wrap items-end gap-x-3 gap-y-3">
            <div className="flex w-full min-w-0 flex-col gap-1 sm:w-80">
              <label htmlFor="new-offer-title" className="label">
                Title
              </label>
              <input
                id="new-offer-title"
                name="title"
                placeholder="Asian Art in London 2026 preview"
                className="field"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="new-offer-kind" className="label">
                Kind
              </label>
              <select id="new-offer-kind" name="kind" className="field">
                {Object.entries(OFFER_KIND_LABELS).map(([value, word]) => (
                  <option key={value} value={value}>
                    {word}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex h-[var(--jvb-control-h)] cursor-pointer items-center gap-2 text-[13px] leading-[1.45] text-ink">
              <input type="checkbox" name="show_prices" className="h-4 w-4 shrink-0" /> Show prices
            </label>
            <Button type="submit" variant="primary" pendingLabel="Creating…">
              Create draft
            </Button>
          </form>
        </Section>

        <Section title="All offers">
          {/* relative: the frame contains the sr-only head words, which
              otherwise sit outside the scroll and widen a phone page. */}
          <TableFrame className="relative">
            <Table className="min-w-[720px]">
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Kind</Th>
                  <Th>Status</Th>
                  <Th numeric>Works</Th>
                  <Th numeric>Recipients</Th>
                  <Th>Created</Th>
                  <Th className="w-40">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const life = lifecycle(o);
                  return (
                    <Tr key={o.id}>
                      <Td>
                        <Link href={`/offers/${o.id}`} className="link-plain font-medium text-ink">
                          {o.title}
                        </Link>
                      </Td>
                      <Td className="text-body">{labelOf(OFFER_KIND_LABELS, o.kind)}</Td>
                      <Td>
                        <Badge
                          variant="dot"
                          tone={life.state === "sent" ? "ok" : "neutral"}
                          hollow={life.state === "draft"}
                        >
                          {life.label}
                        </Badge>
                      </Td>
                      <Td numeric className="text-body">
                        {formatCount(count(o.offer_items))}
                      </Td>
                      <Td numeric className="text-body">
                        {formatCount((o.offer_recipients ?? []).length)}
                      </Td>
                      <Td className="tabular text-body">{formatDate(o.created_at)}</Td>
                      <Td className="py-0 text-right">
                        <DeleteListButton action={deleteOffer} id={o.id} name={o.title} />
                      </Td>
                    </Tr>
                  );
                })}
                {rows.length === 0 ? (
                  <EmptyRow colSpan={7}>No offers yet. Create a draft above.</EmptyRow>
                ) : null}
              </tbody>
            </Table>
          </TableFrame>
        </Section>
      </div>
    </div>
  );
}
