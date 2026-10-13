import { ImportForm } from "./import-form";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

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
    <div className="max-w-[var(--jvb-measure)]">
      <PageHeader back={{ href: "/crm/contacts", label: "All contacts" }} title="Import contacts">
        <p className="text-[13px] leading-[1.45] text-body">
          Upload a <code>.csv</code> file whose first row holds the column headers. Rows that match an existing
          contact by email (or by first and last name when there is no email) are skipped as duplicates.
        </p>
      </PageHeader>

      <div className="space-y-6">
        <Section title="Upload">
          <ImportForm />
        </Section>

        <Section
          title="Accepted column headers"
          meta="Headers are matched without regard to case, and common variants are accepted (firstname, surname, zip, tel)."
        >
          <ul className="flex flex-wrap gap-1.5">
            {HEADERS.map((h) => (
              <li key={h} className="badge">
                {h}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
