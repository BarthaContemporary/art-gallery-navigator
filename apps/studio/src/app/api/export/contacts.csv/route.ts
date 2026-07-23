import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Guard against CSV/formula injection when opened in a spreadsheet: a leading
  // = + - @ (or tab/CR) can execute as a formula. Prefix such cells with '.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
    const cards = (rows ?? []).map((c) => {
      const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
      return [
        "BEGIN:VCARD",
        "VERSION:4.0",
        `N:${c.last_name ?? ""};${c.first_name ?? ""};;;`,
        `FN:${name || c.email || "Contact"}`,
        c.email ? `EMAIL:${c.email}` : null,
        c.phone ? `TEL:${c.phone}` : null,
        c.address_line1
          ? `ADR:;;${[c.address_line1, c.address_line2].filter(Boolean).join(", ")};${c.city ?? ""};;${c.postcode ?? ""};${c.country ?? ""}`
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
  const lines = [
    cols.join(","),
    ...(rows ?? []).map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(",")),
  ];
  return exportResponse(
    request,
    lines.join("\n"),
    "text/csv; charset=utf-8",
    "contacts.csv",
    "Docs",
  );
}
