import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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

/** Canonical column -> accepted header aliases (all matched lower-cased & trimmed). */
const ALIASES: Record<string, string[]> = {
  first_name: ["first name", "firstname", "first", "given name"],
  last_name: ["last name", "lastname", "last", "surname", "family name"],
  email: ["email", "e-mail", "email address"],
  phone: ["phone", "telephone", "tel", "mobile"],
  contact_type: ["type", "contact type"],
  salutation: ["salutation", "title"],
  address_line1: ["address", "address line 1", "address1", "street"],
  address_line2: ["address line 2", "address2"],
  city: ["city", "town"],
  postcode: ["postcode", "post code", "zip", "zip code", "postal code"],
  country: ["country"],
  instagram_handle: ["instagram", "ig"],
  notes: ["notes", "note"],
};

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

  let text: string;
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
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

  // Drop leading fully-empty rows, then take the first as header.
  while (rows.length && (rows[0] ?? []).every((c) => c.trim() === "")) rows.shift();
  const headerRow = rows[0];
  if (!headerRow) {
    return NextResponse.json({ error: "The CSV file is empty" }, { status: 400 });
  }

  const header = headerRow.map((h) => h.trim().toLowerCase());
  // Build header index -> canonical column
  const colFor: (string | null)[] = header.map((h) => {
    for (const [canonical, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(h)) return canonical;
    }
    return null;
  });

  if (colFor.every((c) => c === null)) {
    return NextResponse.json(
      { error: "No recognised column headers found in the CSV" },
      { status: 400 },
    );
  }

  const dataRows = rows.slice(1);

  // Load existing contacts for de-duplication.
  const { data: existing, error: existingError } = await supabase
    .from("crm_contacts")
    .select("email, first_name, last_name");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  for (const c of (existing ?? []) as {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  }[]) {
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
      const val = (cells[idx] ?? "").trim();
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

  return NextResponse.json({ imported, skipped, errors });
}
