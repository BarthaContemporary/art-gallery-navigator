import { SaveToDriveLink } from "@/components/save-to-drive";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { formatCount } from "@/lib/format";

export const metadata = { title: "Contacts" };

/** Contacts per page. The list used to stop at a hard 500, with nothing to say so. */
const PAGE_SIZE = 100;
/** Search shows the best matches only; past this it says so. */
const SEARCH_LIMIT = 200;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const supabase = await getSupabase();

  const cols =
    "id, first_name, last_name, email, contact_type, city, country, marketing_consent, kyc_status, tags";
  const term = (q ?? "").trim();
  const page = Math.max(1, Math.floor(Number(pageParam ?? 1)) || 1);
  let total = 0;
  let rawContacts: unknown = null;
  if (term) {
    // Trigram-fuzzy search (tolerates typos / partial names).
    const { data } = await supabase.rpc("crm_contacts_search", { q: term }).select(cols).limit(SEARCH_LIMIT);
    rawContacts = data;
  } else {
    // One page in SQL, with the total, so every contact can be reached. The
    // first-name and id tie-breaks keep the order stable from page to page.
    const { data, count } = await supabase
      .from("crm_contacts")
      .select(cols, { count: "exact" })
      .order("last_name", { nullsFirst: false })
      .order("first_name", { nullsFirst: false })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    rawContacts = data;
    total = count ?? 0;
    if (page > 1 && !data?.length) {
      // Past the end (an old link after contacts were deleted): go to the last page.
      const { count: all } = await supabase
        .from("crm_contacts")
        .select("id", { count: "exact", head: true });
      const last = Math.max(1, Math.ceil((all ?? 0) / PAGE_SIZE));
      if (last < page) redirect(last > 1 ? `/crm/contacts?page=${last}` : "/crm/contacts");
    }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const contacts = (rawContacts ?? []) as unknown as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    contact_type: string | null;
    city: string | null;
    country: string | null;
    marketing_consent: boolean | null;
    kyc_status: string | null;
    tags: string[] | null;
  }>;

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
          <SaveToDriveLink
            href="/api/export/contacts.csv"
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export CSV / vCard
          </SaveToDriveLink>
          <SaveToDriveLink
            href="/api/export/contacts.xlsx"
            className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12.5px] font-medium text-ink-mid"
          >
            Export XLSX
          </SaveToDriveLink>
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

      {term ? (
        contacts.length >= SEARCH_LIMIT ? (
          <p className="mt-3 text-[12.5px] text-ink-muted">
            Showing the first {SEARCH_LIMIT} matches. Narrow the search to find the rest.
          </p>
        ) : null
      ) : (
        <ContactPager page={page} pages={pages} total={total} label="Pagination, top" className="mt-3" />
      )}

      <div className="mt-4 overflow-x-auto border border-line">
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
                  <Link href={`/crm/contacts/${c.id}`} className="hover:text-ink-strong">
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-ink-muted">{c.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">{c.contact_type}</td>
                <td className="px-4 py-2.5 text-[12.5px] text-ink-muted">
                  {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-[12px]">{c.marketing_consent ? "✓" : "—"}</td>
                <td className="px-4 py-2.5 text-[12px] text-ink-muted">{(c.kyc_status ?? "not started").replace(/_/g, " ")}</td>
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

      {term ? null : (
        <ContactPager page={page} pages={pages} total={total} label="Pagination, bottom" className="mt-3" />
      )}
    </div>
  );
}

/**
 * "101–200 of 869" with Prev and Next, above and below the table (the
 * inventory's pattern: a full page is long to scroll back up). Search results
 * are not paged, so it only carries `page`.
 */
function ContactPager({
  page,
  pages,
  total,
  label,
  className = "",
}: {
  page: number;
  pages: number;
  total: number;
  label: string;
  className?: string;
}) {
  if (total === 0) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  const href = (p: number) => (p > 1 ? `/crm/contacts?page=${p}` : "/crm/contacts");
  const step = (p: number, text: string, disabled: boolean) =>
    disabled ? (
      <span className="rounded-lg border border-line-soft px-2.5 py-1 text-ink-faint opacity-50">{text}</span>
    ) : (
      <Link href={href(p)} className="rounded-lg border border-line-control px-2.5 py-1 hover:bg-control">
        {text}
      </Link>
    );
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <p className="tabular text-[12.5px] text-ink-muted">
        {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
      </p>
      {pages > 1 ? (
        <nav aria-label={label} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          {step(page - 1, "‹ Prev", page === 1)}
          {step(page + 1, "Next ›", page >= pages)}
        </nav>
      ) : null}
    </div>
  );
}
