import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, hasRole, getSupabase } from "@/lib/supabase";

export const metadata = { title: "Duplicate contacts" };
export const dynamic = "force-dynamic";

/**
 * Manual review list for probable duplicate CRM contacts (same normalised
 * full name). Computed live — as duplicates get merged and deleted the list
 * shrinks by itself. Merging stays a human decision: both sides usually
 * carry notes/tags/address data, so nothing is merged automatically.
 */

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
};

function norm(c: Contact) {
  return `${c.first_name ?? ""} ${c.last_name ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default async function DuplicateContactsPage() {
  const { roles } = await requireSession();
  if (!hasRole(roles, "admin") && !hasRole(roles, "staff")) redirect("/");

  const supabase = await getSupabase();
  const { data } = await supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, phone, city, country, tags, notes, created_at")
    .order("created_at");
  const contacts = (data ?? []) as Contact[];

  const byName = new Map<string, Contact[]>();
  for (const c of contacts) {
    const key = norm(c);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  const groups = [...byName.values()].filter((g) => g.length > 1);

  // Purchase counts help decide which record to keep.
  const ids = groups.flat().map((c) => c.id);
  const purchasesById = new Map<string, number>();
  if (ids.length) {
    const { data: buys } = await supabase
      .from("piece_financials")
      .select("buyer_contact_id")
      .in("buyer_contact_id", ids);
    for (const b of buys ?? []) {
      const id = b.buyer_contact_id as string;
      purchasesById.set(id, (purchasesById.get(id) ?? 0) + 1);
    }
  }

  return (
    <div className="max-w-[980px]">
      <Link href="/admin" className="text-[12.5px] text-ink-soft">← Admin</Link>
      <h1 className="mt-2 text-[22px] font-semibold text-ink-strong">Duplicate contacts</h1>
      <p className="mt-2 max-w-[70ch] text-[13px] text-ink-muted">
        Contacts sharing the same name, found during the legacy import. Review each pair: open both,
        copy anything worth keeping (notes, tags, address, purchases link automatically to whichever
        you keep — move them first if needed) into the record you keep, then delete the other. This
        list recomputes on every visit, so it empties as you go.
      </p>

      <p className="mt-4 text-[13px] font-medium text-ink-body">
        {groups.length === 0 ? "No duplicates — all clean. 🎉" : `${groups.length} group${groups.length === 1 ? "" : "s"} to review`}
      </p>

      <div className="mt-4 space-y-4">
        {groups.map((g) => {
          const first = g[0]!;
          return (
          <div key={first.id} className="rounded-[11px] border border-line bg-cell p-4">
            <p className="text-[13px] font-semibold text-ink-strong">
              {first.first_name} {first.last_name}
              <span className="ml-2 font-normal text-ink-soft">({g.length} records)</span>
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-line-soft text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                    <th className="py-1.5 pr-3 font-medium">Contact</th>
                    <th className="py-1.5 pr-3 font-medium">Email / phone</th>
                    <th className="py-1.5 pr-3 font-medium">Place</th>
                    <th className="py-1.5 pr-3 font-medium">Tags</th>
                    <th className="py-1.5 pr-3 font-medium">Purchases</th>
                    <th className="py-1.5 pr-3 font-medium">Notes</th>
                    <th className="py-1.5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {g.map((c) => (
                    <tr key={c.id} className="border-b border-line-soft align-top last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/crm/contacts/${c.id}`} className="text-[13px] font-medium text-oranje hover:underline">
                          Open →
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-[12.5px] text-ink-body">
                        {c.email ?? "—"}
                        {c.phone ? <span className="block text-ink-muted">{c.phone}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-[12.5px] text-ink-muted">
                        {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-2 pr-3 text-[12px] text-ink-muted">{(c.tags ?? []).join(", ") || "—"}</td>
                      <td className="py-2 pr-3 text-[12.5px] text-ink-body">{purchasesById.get(c.id) ?? 0}</td>
                      <td className="max-w-[220px] py-2 pr-3 text-[12px] text-ink-muted">
                        {c.notes ? (c.notes.length > 120 ? `${c.notes.slice(0, 120)}…` : c.notes) : "—"}
                      </td>
                      <td className="py-2 font-mono text-[11.5px] text-ink-soft">
                        {new Date(c.created_at).toLocaleDateString("en-GB")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
