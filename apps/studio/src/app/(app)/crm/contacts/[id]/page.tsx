import Link from "next/link";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import {
  getSupabase,
  getSession,
  canSeeFinancials,
  createServiceClient,
} from "@/lib/supabase";
import { ContactEditor, type Purchase } from "@/components/contact-editor";
import { DeleteContactButton } from "@/components/delete-contact-button";

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

  // Areas of interest (shared master list) + role for price visibility.
  const { data: areaRows } = await supabase
    .from("crm_interest_areas")
    .select("id, name")
    .order("sort_order")
    .order("name");
  const interestOptions = (areaRows ?? []) as { id: string; name: string }[];

  const session = await getSession();
  const showPrices = canSeeFinancials(session?.roles ?? []);

  // Past purchases: works sold to this contact. Read via the service client so
  // all staff see the works even though piece_financials is role-restricted;
  // the price itself is only rendered for admin/accountant (showPrices).
  const svc = createServiceClient();
  const { data: purRows } = await svc
    .from("piece_financials")
    .select("sold_date, sold_price_gbp, piece:pieces ( stock_number, title )")
    .eq("buyer_contact_id", id)
    .order("sold_date", { ascending: false, nullsFirst: false });
  const purchases: Purchase[] = (purRows ?? []).map((r) => {
    const row = r as unknown as {
      sold_date: string | null;
      sold_price_gbp: number | null;
      piece: { stock_number: string | null; title: string | null } | null;
    };
    return {
      stock_number: row.piece?.stock_number ?? null,
      title: row.piece?.title ?? null,
      sold_date: row.sold_date ?? null,
      // Never serialize the price to a non-privileged client: this prop is
      // sent to a "use client" component, so a staff user (denied
      // piece_financials by RLS) could otherwise read it from the flight payload.
      sold_price_gbp: showPrices ? row.sold_price_gbp ?? null : null,
    };
  });

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

      <ContactEditor
        id={id}
        contact={contact}
        purchases={purchases}
        interestOptions={interestOptions}
        showPrices={showPrices}
      />

      {/* danger */}
      <div className="mt-6">
        <DeleteContactButton action={deleteContact} />
      </div>
    </div>
  );
}
