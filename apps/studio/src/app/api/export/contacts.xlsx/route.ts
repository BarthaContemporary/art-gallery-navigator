import { exportResponse } from "@/lib/shared-drive";
import ExcelJS from "exceljs";
import { getSupabase } from "@/lib/supabase";
import { prettyHeader, cellValue, columnWidth, styleSheet } from "@/lib/xlsx-clean";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contacts export — XLSX opens directly in Proton Sheets / Excel. */
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

  const cols = ["first_name", "last_name", "email", "phone", "address_line1", "address_line2", "city", "postcode", "country", "contact_type"];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Contacts");
  ws.columns = cols.map((c) => ({ header: prettyHeader(c), key: c, width: columnWidth(c) }));
  for (const r of rows ?? [])
    ws.addRow(
      cols.reduce(
        (o, c) => {
          o[c] = cellValue(c, (r as Record<string, unknown>)[c]);
          return o;
        },
        {} as Record<string, unknown>,
      ),
    );
  styleSheet(ws, cols);
  const buf = await wb.xlsx.writeBuffer();

  return exportResponse(
    request,
    new Uint8Array(buf as ArrayBuffer),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "contacts.xlsx",
    "Docs",
  );
}
