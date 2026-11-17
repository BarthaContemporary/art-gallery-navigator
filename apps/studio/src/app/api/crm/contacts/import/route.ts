import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { selectAllRows } from "@/lib/paged-read";
import { cleanCell, hasIdentityColumn, mapHeaders } from "./contact-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTACT_TYPES = [
  "collector",
  "museum",
  "dealer",
  "auction_house",
  "shipper",
  "restorer",
  "press",
];

/**
 * Parse CSV text into rows of string cells. Handles quoted fields containing
 * commas and newlines, escaped `""` quotes, and CRLF/LF line endings.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      pushField();
      i++;
      continue;
    }
    if (ch === "\r") {
      // handle CRLF and lone CR
      if (text[i + 1] === "\n") i++;
      pushRow();
      i++;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // flush the trailing field/row unless the file ended with a newline
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

type ContactRow = {
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  instagram_handle: string | null;
  notes: string | null;
};

export async function POST(req: Request) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — ample for a CRM contact export
  const MAX_ROWS = 20000;
  let text: string;
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 5 MB)." },
        { status: 413 },
      );
    }
    text = await file.text();
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file" }, { status: 400 });
  }

  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch {
    return NextResponse.json({ error: "Could not parse the CSV file" }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS}). Split the file and re-import.` },
      { status: 413 },
    );
  }

  // Drop leading fully-empty rows, then take the first as header.
  while (rows.length && (rows[0] ?? []).every((c) => c.trim() === "")) rows.shift();
  const headerRow = rows[0];
  if (!headerRow) {
    return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
  }

  // Header index -> canonical column; the headers that matched nothing are
  // named in the reply, so a column left out is never left out unseen.
  const { columns: colFor, ignored } = mapHeaders(headerRow);

  if (colFor.every((c) => c === null)) {
    return NextResponse.json(
      { error: "No recognised column headers found in the CSV" },
      { status: 400 },
    );
  }
  // Without a name or an email a row cannot be told from an existing contact
  // (and would be imported as a nameless one), so such a file is refused.
  if (!hasIdentityColumn(colFor)) {
    return NextResponse.json(
      {
        error:
          "The file has no name or email column (first name, last name or email), so its rows cannot be matched to contacts.",
        ignored,
      },
      { status: 400 },
    );
  }

  const dataRows = rows.slice(1);

  // Load existing contacts for de-duplication, every page of them: a single
  // read stops at the API's row cap, and contacts past it were imported again.
  type Existing = { email: string | null; first_name: string | null; last_name: string | null };
  let existing: Existing[];
  try {
    existing = await selectAllRows<Existing>((from, to) =>
      supabase.from("crm_contacts").select("email, first_name, last_name").order("id").range(from, to),
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read contacts" }, { status: 500 });
  }

  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  for (const c of existing) {
    if (c.email) seenEmails.add(c.email.trim().toLowerCase());
    const nameKey = `${(c.first_name ?? "").trim().toLowerCase()}|${(c.last_name ?? "")
      .trim()
      .toLowerCase()}`;
    if (nameKey !== "|") seenNames.add(nameKey);
  }

  const toInsert: ContactRow[] = [];
  let skipped = 0;

  for (const cells of dataRows) {
    // Skip completely empty rows.
    if (cells.every((c) => c.trim() === "")) continue;

    const values: Record<string, string> = {};
    for (let idx = 0; idx < colFor.length; idx++) {
      const canonical = colFor[idx];
      if (!canonical) continue;
      const val = cleanCell(cells[idx] ?? "");
      if (val && !values[canonical]) values[canonical] = val;
    }

    const get = (k: string): string | null => values[k] ?? null;

    // A row with no mapped values at all is effectively empty.
    if (Object.keys(values).length === 0) continue;

    let contactType = (values.contact_type ?? "").toLowerCase().replace(/\s+/g, "_");
    if (!CONTACT_TYPES.includes(contactType)) contactType = "collector";

    const emailKey = (values.email ?? "").trim().toLowerCase();
    const nameKey = `${(values.first_name ?? "").trim().toLowerCase()}|${(
      values.last_name ?? ""
    )
      .trim()
      .toLowerCase()}`;

    // De-duplicate.
    if (emailKey) {
      if (seenEmails.has(emailKey)) {
        skipped++;
        continue;
      }
    } else if (nameKey !== "|" && seenNames.has(nameKey)) {
      skipped++;
      continue;
    }

    // Record as seen so duplicates within the same file are also skipped.
    if (emailKey) seenEmails.add(emailKey);
    else if (nameKey !== "|") seenNames.add(nameKey);

    toInsert.push({
      first_name: get("first_name"),
      last_name: get("last_name"),
      salutation: get("salutation"),
      contact_type: contactType,
      email: get("email"),
      phone: get("phone"),
      address_line1: get("address_line1"),
      address_line2: get("address_line2"),
      city: get("city"),
      postcode: get("postcode"),
      country: get("country"),
      instagram_handle: get("instagram_handle"),
      notes: get("notes"),
    });
  }

  let imported = 0;
  let errors = 0;
  const CHUNK = 200;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const batch = toInsert.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("crm_contacts").insert(batch).select("id");
    if (error) {
      errors += batch.length;
    } else {
      imported += data?.length ?? batch.length;
    }
  }

  return NextResponse.json({ imported, skipped, errors, ignored });
}
