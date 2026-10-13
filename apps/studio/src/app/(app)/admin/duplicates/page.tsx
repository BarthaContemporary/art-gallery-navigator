import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, hasRole, getSupabase } from "@/lib/supabase";
// London dates: this page renders on the server, where the zone is UTC.
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

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

/**
 * One set of widths for every group's table, in px (Contact, Email and
 * phone, Place, Tags, Purchases, Notes, Created). Notes takes what is left.
 */
const GROUP_COLUMNS = [72, 256, 136, 104, 104, null, 104] as const;

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
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/admin", label: "Admin" }}
        title="Duplicate contacts"
        meta={
          groups.length === 0
            ? "No duplicates"
            : `${groups.length} group${groups.length === 1 ? "" : "s"} to review`
        }
      />
      <p className="mb-6 max-w-[70ch] text-[13.5px] leading-[1.5] text-body">
        Contacts sharing the same name, found during the legacy import. Review each pair: open both,
        copy anything worth keeping (notes, tags, address) into the record you keep, then delete the
        other. Purchases stay linked to the record they are on, so move them first if needed. This
        list recomputes on every visit, so it empties as you go.
      </p>

      {groups.length === 0 ? (
        <EmptyState action={<ButtonLink href="/crm/contacts">Open contacts</ButtonLink>}>
          No duplicates left: every contact name is unique.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => {
            const first = g[0]!;
            return (
              <Section
                key={first.id}
                level={2}
                title={`${first.first_name ?? ""} ${first.last_name ?? ""}`.trim()}
                meta={`${g.length} records`}
              >
                <TableFrame>
                  {/* Fixed layout on one set of column widths, so every group's
                      columns line up down the page and pairs compare at a glance. */}
                  <Table className="min-w-[880px]" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      {GROUP_COLUMNS.map((w, i) => (
                        <col key={i} style={w ? { width: w } : undefined} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <Th>Contact</Th>
                        <Th>Email and phone</Th>
                        <Th>Place</Th>
                        <Th>Tags</Th>
                        <Th numeric>Purchases</Th>
                        <Th>Notes</Th>
                        <Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.map((c) => (
                        <Tr key={c.id} className="align-top">
                          <Td className="align-top">
                            <Link href={`/crm/contacts/${c.id}`} className="link">
                              Open
                            </Link>
                          </Td>
                          <Td className="break-words align-top text-ink">
                            {c.email ?? "—"}
                            {c.phone ? <span className="block text-[12px] text-meta">{c.phone}</span> : null}
                          </Td>
                          <Td className="align-top text-body">
                            {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                          </Td>
                          <Td className="align-top text-[12px] text-body">{(c.tags ?? []).join(", ") || "—"}</Td>
                          <Td numeric className="align-top text-ink">
                            {purchasesById.get(c.id) ?? 0}
                          </Td>
                          <Td className="break-words align-top text-[12px] text-body">
                            {c.notes ? (c.notes.length > 120 ? `${c.notes.slice(0, 120)}…` : c.notes) : "—"}
                          </Td>
                          <Td className="tabular whitespace-nowrap align-top text-[12px] text-meta">
                            {formatDate(c.created_at, "short")}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableFrame>
              </Section>
            );
          })}
        </div>
      )}
    </div>
  );
}
