import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await getSupabase();

  let query = supabase
    .from("crm_contacts")
    .select("id, first_name, last_name, email, contact_type, city, country, marketing_consent, kyc_status, tags")
    .order("last_name", { nullsFirst: false })
    .limit(500);
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: contacts } = await query;

  // Create a blank contact and open the full editor (autosaves).
  async function addContact() {
    "use server";
    const db = await getSupabase();
    const { data } = await db
      .from("crm_contacts")
      .insert({ contact_type: "collector" })
      .select("id")
      .single();
    if (data) redirect(`/crm/contacts/${data.id}`);
    redirect("/crm/contacts");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/contacts.csv"
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export CSV / vCard
          </a>
          <a
            href="/api/export/contacts.xlsx"
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export XLSX
          </a>
          <Link
            href="/crm/contacts/import"
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Import CSV
          </Link>
          <form action={addContact}>
            <button
              type="submit"
              className="rounded-lg bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-fg"
            >
              Add contact
            </button>
          </form>
        </div>
      </div>

      <form method="get" className="mt-4">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or email…"
          className="w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] sm:w-80"
        />
      </form>

      <div className="mt-4 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Place</th>
              <th className="px-4 py-2.5 font-medium">Consent</th>
              <th className="px-4 py-2.5 font-medium">AML</th>
            </tr>
          </thead>
          <tbody>
            {(contacts ?? []).map((c) => (
              <tr key={c.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                <td className="px-4 py-2.5 text-[13.5px] text-ink-body">
                  <a href={`/crm/contacts/${c.id}`} className="hover:text-ink-strong">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </a>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-ink-muted">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">{c.contact_type}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">
                  {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-[12px]">{c.marketing_consent ? "✓" : "—"}</td>
                <td className="px-4 py-2.5 text-[12px] text-ink-muted">{c.kyc_status.replace(/_/g, " ")}</td>
              </tr>
            ))}
            {(contacts ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-muted">
                  No contacts yet — add one or import a CSV.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
