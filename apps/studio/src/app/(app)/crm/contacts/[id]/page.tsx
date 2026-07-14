import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ContactEditor } from "@/components/contact-editor";

export const metadata = { title: "Contact" };

type Contact = {
  id: string;
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
  whatsapp_number: string | null;
  line_id: string | null;
  wechat_id: string | null;
  tags: string[];
  custom_fields: Record<string, unknown> | null;
  marketing_consent: boolean;
  do_not_mail: boolean;
  kyc_status: string;
  sanctions_status: string | null;
  last_screened_at: string | null;
  notes: string | null;
};

const AML_OPTIONS: Record<string, string> = {
  not_started: "Not started",
  pending: "In progress",
  verified: "Confirmed",
  refer: "Refer",
  rejected: "Rejected",
};

export default async function ContactProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const contact = data as unknown as Contact | null;
  if (!contact) notFound();

  const name =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unnamed contact";
  const amlDate =
    typeof contact.custom_fields?.aml_confirmed_date === "string"
      ? (contact.custom_fields.aml_confirmed_date as string)
      : "";

  async function deleteContact() {
    "use server";
    const db = await getSupabase();
    await db.from("crm_contacts").delete().eq("id", id);
    redirect("/crm/contacts");
  }

  return (
    <div className="max-w-[900px]">
      <Link href="/crm/contacts" className="text-[12.5px] text-ink-soft">
        ← All contacts
      </Link>

      {/* header */}
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-band text-[18px] text-ink-soft">
          {(contact.first_name?.[0] ?? contact.last_name?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-ink-strong">{name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {contact.contact_type.replace(/_/g, " ")}
            {contact.email ? ` · ${contact.email}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-line-control px-2.5 py-0.5 text-[11px] text-ink-mid">
              AML: {AML_OPTIONS[contact.kyc_status] ?? contact.kyc_status}
              {amlDate ? ` · ${amlDate}` : ""}
            </span>
            {contact.sanctions_status ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] ${
                  contact.sanctions_status === "potential_match"
                    ? "bg-tag-dark text-primary-fg"
                    : "border border-line-control text-ink-mid"
                }`}
              >
                Sanctions: {contact.sanctions_status.replace(/_/g, " ")}
                {contact.last_screened_at
                  ? ` · ${new Date(contact.last_screened_at).toLocaleDateString("en-GB")}`
                  : ""}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <ContactEditor id={id} contact={contact} />

      {/* danger */}
      <form action={deleteContact} className="mt-6">
        <button
          type="submit"
          className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink-strong"
        >
          Delete contact
        </button>
      </form>
    </div>
  );
}
