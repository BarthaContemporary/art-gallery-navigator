import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";

export const metadata = { title: "Trash" };

const RETENTION_DAYS = 30;

type TrashRow = {
  id: string;
  stock_number: string;
  title: string | null;
  deleted_at: string;
};

export default async function TrashPage() {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("pieces")
    .select("id, stock_number, title, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const rows = (data ?? []) as TrashRow[];

  async function reinstate(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await db.from("pieces").update({ deleted_at: null }).eq("id", id);
    revalidatePath("/inventory/trash");
    revalidatePath("/inventory");
  }

  async function purge(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    // Permanent delete (cascades to images, financials, provenance, …).
    await db.from("pieces").delete().eq("id", id);
    revalidatePath("/inventory/trash");
  }

  const daysLeft = (deletedAt: string) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-strong">Trash</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Deleted records are kept for {RETENTION_DAYS} days, then permanently removed.
          </p>
        </div>
        <Link href="/inventory" className="text-[12.5px] text-ink-mid hover:text-oranje">
          ← Inventory
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Stock</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Deleted</th>
              <th className="px-4 py-2.5 font-medium">Auto-removed in</th>
              <th className="px-4 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{r.stock_number}</td>
                <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{r.title ?? "Untitled"}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-soft">
                  {new Date(r.deleted_at).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {daysLeft(r.deleted_at)} days
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-3">
                    <form action={reinstate}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-[12px] font-medium text-primary">
                        Reinstate
                      </button>
                    </form>
                    <DeleteListButton action={purge} id={r.id} name={r.stock_number} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  Trash is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
