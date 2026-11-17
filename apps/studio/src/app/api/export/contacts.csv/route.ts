import { exportResponse } from "@/lib/shared-drive";
import { getSupabase } from "@/lib/supabase";
import { csvFile, csvLine } from "@/lib/csv";
import { selectAllRows } from "@/lib/paged-read";

/**
 * Contacts export as CSV (Proton Sheets, Excel). The vCard export of every
 * contact is /api/export/contacts.vcf, which the contacts page offers beside
 * this one.
 */
export async function GET(request: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const cols = ["first_name", "last_name", "email", "phone", "address_line1", "address_line2", "city", "postcode", "country", "contact_type"];
  let rows: Record<string, unknown>[];
  try {
    // Paged, so a row cap on the API cannot cut the file short; id breaks
    // ties so no contact is skipped or repeated between pages.
    rows = await selectAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("crm_contacts")
        .select(cols.join(", "))
        .order("last_name", { nullsFirst: false })
        .order("id")
        .range(from, to) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>,
    );
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 500 });
  }

  // Every cell through the shared guard: names and addresses come from the
  // website's enquiry and booking forms, so they are outsiders' text.
  const lines = [csvLine(cols), ...rows.map((r) => csvLine(cols.map((c) => r[c])))];
  return exportResponse(request, csvFile(lines), "text/csv; charset=utf-8", "contacts.csv", "Docs");
}
