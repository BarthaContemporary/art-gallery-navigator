import Link from "next/link";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import contacts" };

const HEADERS = [
  "first name",
  "last name",
  "email",
  "phone",
  "type",
  "salutation",
  "address",
  "address line 2",
  "city",
  "postcode",
  "country",
  "instagram",
  "notes",
];

export default function ImportContactsPage() {
  return (
    <div className="max-w-[720px]">
      <Link href="/crm/contacts" className="text-[12.5px] text-ink-soft">
        ← All contacts
      </Link>

      <h1 className="mt-2 text-[26px] font-semibold text-ink-strong">Import contacts</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        Upload a <code>.csv</code> file. The first row must be column headers.
        Rows that match an existing contact by email — or by first &amp; last name
        when no email is given — are skipped as duplicates.
      </p>

      <div className="mt-5 rounded-[11px] border border-line bg-cell p-5">
        <ImportForm />
      </div>

      <div className="mt-5 rounded-[11px] border border-line bg-cell p-5">
        <h2 className="text-[13px] font-semibold text-ink-strong">Accepted column headers</h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          Headers are matched case-insensitively, and common variants are
          accepted (e.g. <code>firstname</code>, <code>surname</code>,{" "}
          <code>zip</code>, <code>tel</code>).
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {HEADERS.map((h) => (
            <span
              key={h}
              className="rounded-full border border-line-control px-2.5 py-0.5 text-[11px] text-ink-mid"
            >
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
