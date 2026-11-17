import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getSupabase } from "@/lib/supabase";
import { CONTACTS_PAGE_LIMIT, findContacts, mayHaveMore, selectContactsPage } from "@/lib/contact-search";
import { formatCount } from "@/lib/format";
import { CONTACT_TYPE_LABELS, KYC_STATUS_LABELS, KYC_STATUS_TONES, labelOf } from "@/lib/labels";
import { ExportMenu } from "@/components/export-menu";
import { PageHeader } from "@/components/ui/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";
import { Pager } from "@/components/ui/pager";
import { Notice } from "@/components/ui/notice";
import { SearchIcon } from "@/components/ui/icons";

export const metadata = { title: "Contacts" };

/** Contacts per page. The list used to stop at a hard 500, with nothing to say so. */
const PAGE_SIZE = 100;

type ContactListRow = {
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
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  // The roles decide whether the contacts index is asked (admin and staff);
  // the layout has read the session already, so this is the cached one.
  const session = await getSession();
  if (!session) redirect("/login");
  const supabase = await getSupabase();

  const cols =
    "id, first_name, last_name, email, contact_type, city, country, marketing_consent, kyc_status, tags";
  const term = (q ?? "").trim();
  const page = Math.max(1, Math.floor(Number(pageParam ?? 1)) || 1);
  let total = 0;
  let contacts: ContactListRow[] = [];
  // Search: the best matches, not paged. crm_contacts_search stops at 100 by
  // itself; with the contacts index merged in, up to CONTACTS_PAGE_LIMIT.
  let similar = false;
  let more = false;
  let searchError: string | null = null;
  if (term) {
    const found = await findContacts<ContactListRow>(supabase, term, {
      roles: session.roles,
      columns: cols,
      limit: CONTACTS_PAGE_LIMIT,
    });
    contacts = found.rows;
    similar = found.similar;
    more = mayHaveMore(found.found, CONTACTS_PAGE_LIMIT);
    searchError = found.error?.message ?? null;
  } else {
    // One page in SQL, with the total, so every contact can be reached.
    ({ rows: contacts, total } = await selectContactsPage<ContactListRow>(supabase, cols, page, PAGE_SIZE));
    if (page > 1 && contacts.length === 0) {
      // Past the end (an old link after contacts were deleted): go to the last page.
      const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (last < page) redirect(last > 1 ? `/crm/contacts?page=${last}` : "/crm/contacts");
    }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  // The header's count: every contact when browsing, the matches when searching.
  const meta = term
    ? `${formatCount(contacts.length)}${more ? "+" : ""} ${similar ? "similar " : ""}${
        contacts.length === 1 ? "match" : "matches"
      } for “${term}”`
    : `${formatCount(total)} ${total === 1 ? "contact" : "contacts"}`;

  return (
    <div>
      <PageHeader
        title="Contacts"
        meta={<span className="tabular">{meta}</span>}
        actions={
          <>
            <ButtonLink href="/crm/contacts/import" variant="quiet">
              Import CSV
            </ButtonLink>
            <ExportMenu
              noun="contacts"
              items={[
                { href: "/api/export/contacts.csv", label: "CSV" },
                { href: "/api/export/contacts.xlsx", label: "Excel (XLSX)" },
                { href: "/api/export/contacts.vcf", label: "vCard" },
              ]}
            />
            <form action={addContact}>
              <Button type="submit" variant="primary" pendingLabel="Adding…">
                Add contact
              </Button>
            </form>
          </>
        }
      />

      <form method="get" role="search" aria-label="Search contacts" className="flex flex-wrap items-end gap-2">
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-80">
          <label htmlFor="contacts-search" className="label">
            Search
          </label>
          <input
            id="contacts-search"
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name or email"
            className="field"
          />
        </div>
        <Button type="submit" icon={<SearchIcon size={14} />}>
          Search
        </Button>
        {term ? (
          <ButtonLink href="/crm/contacts" variant="quiet">
            Clear search
          </ButtonLink>
        ) : null}
      </form>

      {term ? (
        searchError ? (
          <Notice tone="danger" className="mt-3">
            Couldn&rsquo;t search the contacts ({searchError}). Try again in a moment.
          </Notice>
        ) : (
          <>
            {similar ? (
              <p className="mt-3 text-[12px] leading-[1.4] text-meta">
                No exact matches for &ldquo;{term}&rdquo;. Showing similar contacts.
              </p>
            ) : null}
            {more ? (
              // The count shown, not a fixed number: without the contacts index
              // the search stops at 100, with it at 200.
              <p className="mt-3 text-[12px] leading-[1.4] text-meta">
                Showing the best {formatCount(contacts.length)} matches. There may be more: narrow the search to find
                them.
              </p>
            ) : null}
          </>
        )
      ) : (
        <ContactPager page={page} pages={pages} total={total} label="Pagination, top" className="mt-4" />
      )}

      <TableFrame className="mt-3">
        <Table className="min-w-[720px]">
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Type</Th>
              <Th>Place</Th>
              <Th>Consent</Th>
              <Th>AML</Th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const kyc = c.kyc_status ?? "not_started";
              const kycTone = KYC_STATUS_TONES[kyc] ?? "neutral";
              return (
                // nowrap: on a phone the table scrolls sideways rather than
                // breaking every name over two lines.
                <Tr key={c.id} className="whitespace-nowrap">
                  <Td>
                    <Link href={`/crm/contacts/${c.id}`} className="link-plain font-medium text-ink">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact"}
                    </Link>
                  </Td>
                  <Td className="text-body">{c.email ?? "—"}</Td>
                  <Td className="text-body">{labelOf(CONTACT_TYPE_LABELS, c.contact_type)}</Td>
                  <Td className="text-body">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</Td>
                  <Td>
                    {c.marketing_consent ? (
                      <Badge variant="dot" tone="ok">
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-meta">No</span>
                    )}
                  </Td>
                  <Td>
                    {/* Not started is most rows: plain words, marked only
                        where the check asks something of the gallery. */}
                    {kycTone === "neutral" ? (
                      <span className="text-meta">{labelOf(KYC_STATUS_LABELS, kyc)}</span>
                    ) : (
                      <Badge variant="dot" tone={kycTone}>
                        {labelOf(KYC_STATUS_LABELS, kyc)}
                      </Badge>
                    )}
                  </Td>
                </Tr>
              );
            })}
            {contacts.length === 0 ? (
              term && searchError ? (
                <EmptyRow colSpan={6}>The search failed; nothing to show.</EmptyRow>
              ) : term ? (
                <EmptyRow
                  colSpan={6}
                  action={
                    <ButtonLink href="/crm/contacts" size="sm">
                      Clear search
                    </ButtonLink>
                  }
                >
                  No contact matches “{term}”.
                </EmptyRow>
              ) : (
                <EmptyRow
                  colSpan={6}
                  action={
                    <ButtonLink href="/crm/contacts/import" size="sm">
                      Import CSV
                    </ButtonLink>
                  }
                >
                  No contacts yet. Add one, or import a CSV file.
                </EmptyRow>
              )
            ) : null}
          </tbody>
        </Table>
      </TableFrame>

      {term ? null : (
        <ContactPager page={page} pages={pages} total={total} label="Pagination, bottom" className="mt-3" />
      )}
    </div>
  );
}

/**
 * "101–200 of 869" and the shared Pager (First, Previous, Page n of m, Next,
 * Last), above and below the table, as on the inventory: a full page is
 * long to scroll back up. Search results are not paged, so the links carry
 * `page` only, and page 1 is the bare /crm/contacts as before.
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
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <p className="tabular text-[12px] leading-[1.4] text-meta">
        {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
      </p>
      <Pager page={page} pages={pages} href={href} label={label} />
    </div>
  );
}
