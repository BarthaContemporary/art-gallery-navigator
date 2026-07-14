import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

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
  }): { label: string; sent: number } {
    const recs = o.offer_recipients ?? [];
    const sent = recs.filter((r) => r.sent_at).length;
    const expired = o.expires_at != null && new Date(o.expires_at).getTime() < Date.now();
    if (expired) return { label: "expired", sent };
    if (sent > 0) return { label: `sent · ${sent}`, sent };
    return { label: "draft", sent };
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

  const count = (v: unknown) => (v as { count: number }[])[0]?.count ?? 0;

  return (
    <div>
      <p className="text-[13px] text-ink-muted">
        Tokenized private pages sent to collectors — offers, art-fair previews, viewing rooms.
      </p>
      <form action={createOffer} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Title
          <input name="title" placeholder="Asian Art in London 2026 preview" className="mt-1 block w-80 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
          Kind
          <select name="kind" className="mt-1 block rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]">
            <option value="offer">Offer</option>
            <option value="fair_preview">Fair preview</option>
            <option value="viewing_room">Viewing room</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-[12.5px] text-ink-body">
          <input type="checkbox" name="show_prices" /> Show prices
        </label>
        <button type="submit" className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
          Create draft
        </button>
      </form>

      <div className="mt-5 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Kind</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Works</th>
              <th className="px-4 py-2.5 font-medium">Recipients</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(offers ?? []).map((o) => (
              <tr key={o.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5 text-[13.5px] text-ink-body">
                  <Link href={`/offers/${o.id}`}>{o.title}</Link>
                </td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">{o.kind.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">{lifecycle(o).label}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">{count(o.offer_items)}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">{(o.offer_recipients ?? []).length}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-soft">
                  {new Date(o.created_at).toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
            {(offers ?? []).length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-muted">No offers yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">
        Open an offer to add works, choose recipients and send tokenized private links.
      </p>
    </div>
  );
}
