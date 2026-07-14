import { revalidatePath } from "next/cache";
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
    .limit(200);
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: contacts } = await query;

  async function addContact(formData: FormData) {
    "use server";
    const supabase = await getSupabase();
    const last_name = String(formData.get("last_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (!last_name && !email) return;
    await supabase.from("crm_contacts").insert({
      first_name: String(formData.get("first_name") ?? "").trim() || null,
      last_name: last_name || null,
      email: email || null,
      contact_type: String(formData.get("contact_type") ?? "collector"),
    });
    revalidatePath("/crm/contacts");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-semibold text-ink-strong">Contacts</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <form method="get">
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
                  <th className="px-4 py-2.5 font-medium">KYC</th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-line-soft last:border-0">
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
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-ink-muted">No contacts yet — import a CSV or add one.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="h-fit rounded-[11px] border border-line bg-cell p-5">
          <h2 className="text-[13px] font-semibold text-ink-strong">Add contact</h2>
          <form action={addContact} className="mt-3 space-y-3">
            {[["first_name", "First name"], ["last_name", "Last name"], ["email", "Email"]].map(([name, l]) => (
              <label key={name} className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                {l}
                <input name={name} className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]" />
              </label>
            ))}
            <label className="block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
              Type
              <select name="contact_type" className="mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px]">
                {["collector", "museum", "dealer", "auction_house", "shipper", "restorer", "press"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="w-full rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
              Add
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
