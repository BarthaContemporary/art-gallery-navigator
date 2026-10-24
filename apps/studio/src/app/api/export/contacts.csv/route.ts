import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { csvLine } from "@/lib/csv";

/**
 * Contacts export. format=csv (default, Proton Sheets) or format=vcf
 * (vCard 4.0 — imports directly into Proton Mail contacts).
 */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: rows, error } = await supabase
    .from("crm_contacts")
    .select("first_name, last_name, email, phone, address_line1, address_line2, city, postcode, country, contact_type")
    .order("last_name", { nullsFirst: false });
  if (error) return new Response(error.message, { status: 500 });

  const format = new URL(request.url).searchParams.get("format") ?? "csv";

  if (format === "vcf") {
    // Every value escaped as the vCard format requires (as the dedicated
    // contacts.vcf export does), so a line break or semicolon in a name or
    // address — which a website visitor could type — cannot add lines or
    // fields to the card.
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\r|\n/g, "\\n")
        .replace(/([,;])/g, "\\$1");
    const cards = (rows ?? []).map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      return [
        "BEGIN:VCARD",
        "VERSION:4.0",
        `N:${esc(c.last_name)};${esc(c.first_name)};;;`,
        `FN:${esc(name || c.email || "Contact")}`,
        c.email ? `EMAIL:${esc(c.email)}` : null,
        c.phone ? `TEL:${esc(c.phone)}` : null,
        c.address_line1
          ? `ADR:;;${esc([c.address_line1, c.address_line2].filter(Boolean).join(", "))};${esc(c.city)};;${esc(c.postcode)};${esc(c.country)}`
          : null,
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

  const cols = ["first_name", "last_name", "email", "phone", "address_line1", "address_line2", "city", "postcode", "country", "contact_type"];
  // Every cell through the shared guard: names and addresses come from the
  // website's enquiry and booking forms, so they are outsiders' text.
  const lines = [
    csvLine(cols),
    ...(rows ?? []).map((r) => csvLine(cols.map((c) => (r as Record<string, unknown>)[c]))),
  ];
  return exportResponse(
    request,
    lines.join("\n"),
    "text/csv; charset=utf-8",
    "contacts.csv",
    "Docs",
  );
}
