import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backslash-escape commas, semicolons and newlines per vCard 3.0. */
function esc(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
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
    const { data: rows, error } = await supabase
      .from("crm_list_members")
      .select(`contact:crm_contacts(${CONTACT_FIELDS})`)
      .eq("list_id", list);
    if (error) return new Response(error.message, { status: 500 });
    contacts = (rows ?? [])
      .map((r) => (r as unknown as { contact: ContactRow | null }).contact)
      .filter((c): c is ContactRow => c != null);
  } else {
    const { data: rows, error } = await supabase
      .from("crm_contacts")
      .select(CONTACT_FIELDS)
      .order("last_name", { nullsFirst: false });
    if (error) return new Response(error.message, { status: 500 });
    contacts = (rows ?? []) as unknown as ContactRow[];
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

  return new Response(cards.join("\r\n"), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts.vcf"',
    },
  });
}
