import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { loadListContacts } from "@/lib/crm-list-members";
import { selectAllRows } from "@/lib/paged-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backslash-escape commas, semicolons and newlines per vCard 3.0. */
function esc(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

interface ContactRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  org: { name: string | null } | null;
}

const CONTACT_FIELDS =
  "first_name, last_name, email, phone, address_line1, address_line2, city, postcode, country, org:crm_organizations(name)";

export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const list = new URL(request.url).searchParams.get("list");

  let contacts: ContactRow[];
  if (list) {
    const { data: listRow } = await supabase
      .from("crm_lists")
      .select("id, is_dynamic, filter_rules")
      .eq("id", list)
      .maybeSingle();
    if (!listRow) return new Response("List not found", { status: 404 });
    try {
      contacts = await loadListContacts<ContactRow & { id: string }>(
        supabase,
        listRow,
        CONTACT_FIELDS,
      );
    } catch (e) {
      return new Response(e instanceof Error ? e.message : "Could not read list", { status: 500 });
    }
  } else {
    try {
      // Paged, so a row cap on the API cannot cut the file short; id breaks
      // ties so no contact is skipped or repeated between pages.
      contacts = await selectAllRows<ContactRow>((from, to) =>
        supabase
          .from("crm_contacts")
          .select(CONTACT_FIELDS)
          .order("last_name", { nullsFirst: false })
          .order("id")
          .range(from, to) as unknown as PromiseLike<{
          data: ContactRow[] | null;
          error: { message: string } | null;
        }>,
      );
    } catch (e) {
      return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
    }
  }

  const cards = contacts
    .filter((c) => c.email || c.first_name || c.last_name)
    .map((c) => {
      const first = esc(c.first_name);
      const last = esc(c.last_name);
      const fn = [c.first_name, c.last_name].filter(Boolean).map(esc).join(" ");
      const adr =
        c.address_line1 || c.address_line2 || c.city || c.postcode || c.country
          ? `ADR;TYPE=HOME:;;${esc([c.address_line1, c.address_line2].filter(Boolean).join(" "))};${esc(c.city)};;${esc(c.postcode)};${esc(c.country)}`
          : null;
      return [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${last};${first};;;`,
        fn ? `FN:${fn}` : null,
        c.org?.name ? `ORG:${esc(c.org.name)}` : null,
        c.email ? `EMAIL;TYPE=INTERNET:${esc(c.email)}` : null,
        c.phone ? `TEL:${esc(c.phone)}` : null,
        adr,
        "END:VCARD",
      ]
        .filter(Boolean)
        .join("\r\n");
    });

  return exportResponse(
    request,
    cards.join("\r\n"),
    "text/vcard; charset=utf-8",
    "contacts.vcf",
    "Docs",
  );
}
