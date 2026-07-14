import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

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

const label = "block text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint";
const input =
  "mt-1 w-full rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] text-ink-body";

const AML_OPTIONS: [string, string][] = [
  ["not_started", "Not started"],
  ["pending", "In progress"],
  ["verified", "Confirmed"],
  ["refer", "Refer"],
  ["rejected", "Rejected"],
];

function cf(c: Contact, key: string): string {
  const v = c.custom_fields?.[key];
  return typeof v === "string" ? v : "";
}

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
  const photo = cf(contact, "photo_url");

  async function updateContact(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { data: current } = await db
      .from("crm_contacts")
      .select("custom_fields")
      .eq("id", id)
      .maybeSingle();
    const existing =
      ((current as { custom_fields: Record<string, unknown> | null } | null)
        ?.custom_fields as Record<string, unknown>) ?? {};
    const s = (k: string) => String(formData.get(k) ?? "").trim() || null;
    await db
      .from("crm_contacts")
      .update({
        first_name: s("first_name"),
        last_name: s("last_name"),
        salutation: s("salutation"),
        contact_type: String(formData.get("contact_type") ?? "collector"),
        email: s("email"),
        phone: s("phone"),
        address_line1: s("address_line1"),
        address_line2: s("address_line2"),
        city: s("city"),
        postcode: s("postcode"),
        country: s("country"),
        instagram_handle: s("instagram_handle"),
        whatsapp_number: s("whatsapp_number"),
        line_id: s("line_id"),
        wechat_id: s("wechat_id"),
        marketing_consent: formData.get("marketing_consent") === "on",
        do_not_mail: formData.get("do_not_mail") === "on",
        notes: s("notes"),
        custom_fields: {
          ...existing,
          linkedin: String(formData.get("linkedin") ?? "").trim(),
          x_handle: String(formData.get("x_handle") ?? "").trim(),
          website: String(formData.get("website") ?? "").trim(),
          photo_url: String(formData.get("photo_url") ?? "").trim(),
        },
      })
      .eq("id", id);
    revalidatePath(`/crm/contacts/${id}`);
  }

  async function updateAml(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { data: current } = await db
      .from("crm_contacts")
      .select("custom_fields")
      .eq("id", id)
      .maybeSingle();
    const existing =
      ((current as { custom_fields: Record<string, unknown> | null } | null)
        ?.custom_fields as Record<string, unknown>) ?? {};
    await db
      .from("crm_contacts")
      .update({
        kyc_status: String(formData.get("kyc_status") ?? "not_started"),
        custom_fields: {
          ...existing,
          aml_confirmed_date: String(formData.get("aml_confirmed_date") ?? "").trim(),
          aml_notes: String(formData.get("aml_notes") ?? "").trim(),
        },
      })
      .eq("id", id);
    revalidatePath(`/crm/contacts/${id}`);
  }

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
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-band text-[18px] text-ink-soft">
            {(contact.first_name?.[0] ?? contact.last_name?.[0] ?? "?").toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold text-ink-strong">{name}</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {contact.contact_type.replace(/_/g, " ")}
            {contact.email ? ` · ${contact.email}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-line-control px-2.5 py-0.5 text-[11px] text-ink-mid">
              AML: {AML_OPTIONS.find(([v]) => v === contact.kyc_status)?.[1] ?? contact.kyc_status}
              {cf(contact, "aml_confirmed_date") ? ` · ${cf(contact, "aml_confirmed_date")}` : ""}
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

      {/* AML / in-house KYC */}
      <form
        action={updateAml}
        className="mt-6 grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-3"
      >
        <div className="sm:col-span-3">
          <h2 className="text-[13px] font-semibold text-ink-strong">
            AML (in-house)
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Recorded by the gallery with its AML adviser. Confirmed contacts are
            screened against the UK Sanctions List every two weeks.
          </p>
        </div>
        <label className={label}>
          Status
          <select name="kyc_status" defaultValue={contact.kyc_status} className={input}>
            {AML_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Confirmed date
          <input
            type="date"
            name="aml_confirmed_date"
            defaultValue={cf(contact, "aml_confirmed_date")}
            className={input}
          />
        </label>
        <label className={label}>
          Note (reference / adviser)
          <input
            name="aml_notes"
            defaultValue={cf(contact, "aml_notes")}
            className={input}
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
          >
            Save AML
          </button>
        </div>
      </form>

      {/* details */}
      <form
        action={updateContact}
        className="mt-6 grid grid-cols-1 gap-4 rounded-[11px] border border-line bg-cell p-5 sm:grid-cols-2"
      >
        <h2 className="text-[13px] font-semibold text-ink-strong sm:col-span-2">
          Details
        </h2>
        <label className={label}>
          First name
          <input name="first_name" defaultValue={contact.first_name ?? ""} className={input} />
        </label>
        <label className={label}>
          Last name
          <input name="last_name" defaultValue={contact.last_name ?? ""} className={input} />
        </label>
        <label className={label}>
          Salutation
          <input
            name="salutation"
            defaultValue={contact.salutation ?? ""}
            placeholder="Dear Professor Tanaka"
            className={input}
          />
        </label>
        <label className={label}>
          Type
          <select name="contact_type" defaultValue={contact.contact_type} className={input}>
            {["collector", "museum", "dealer", "auction_house", "shipper", "restorer", "press"].map(
              (t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ),
            )}
          </select>
        </label>
        <label className={label}>
          Email
          <input name="email" defaultValue={contact.email ?? ""} className={input} />
        </label>
        <label className={label}>
          Phone
          <input name="phone" defaultValue={contact.phone ?? ""} className={input} />
        </label>

        {/* Mailing address */}
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:col-span-2">
          Mailing address
        </p>
        <label className={label}>
          Address line 1
          <input name="address_line1" defaultValue={contact.address_line1 ?? ""} className={input} />
        </label>
        <label className={label}>
          Address line 2
          <input name="address_line2" defaultValue={contact.address_line2 ?? ""} className={input} />
        </label>
        <label className={label}>
          City
          <input name="city" defaultValue={contact.city ?? ""} className={input} />
        </label>
        <label className={label}>
          Postcode
          <input name="postcode" defaultValue={contact.postcode ?? ""} className={input} />
        </label>
        <label className={label}>
          Country
          <input name="country" defaultValue={contact.country ?? ""} className={input} />
        </label>
        <div />

        {/* Social / online */}
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint sm:col-span-2">
          Social & online
        </p>
        <label className={label}>
          Instagram
          <input name="instagram_handle" defaultValue={contact.instagram_handle ?? ""} className={input} />
        </label>
        <label className={label}>
          LinkedIn (URL)
          <input name="linkedin" defaultValue={cf(contact, "linkedin")} className={input} />
        </label>
        <label className={label}>
          X / Twitter
          <input name="x_handle" defaultValue={cf(contact, "x_handle")} className={input} />
        </label>
        <label className={label}>
          Website
          <input name="website" defaultValue={cf(contact, "website")} className={input} />
        </label>
        <label className={label}>
          WhatsApp
          <input name="whatsapp_number" defaultValue={contact.whatsapp_number ?? ""} className={input} />
        </label>
        <label className={label}>
          WeChat / LINE
          <input name="wechat_id" defaultValue={contact.wechat_id ?? ""} className={input} />
        </label>
        <input type="hidden" name="line_id" defaultValue={contact.line_id ?? ""} />
        <label className={`${label} sm:col-span-2`}>
          Photo URL (collector image)
          <input
            name="photo_url"
            defaultValue={photo}
            placeholder="https://…"
            className={input}
          />
        </label>

        {/* consent + notes */}
        <label className="flex items-center gap-2 text-[12.5px] text-ink-body">
          <input type="checkbox" name="marketing_consent" defaultChecked={contact.marketing_consent} />
          Marketing consent
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-body">
          <input type="checkbox" name="do_not_mail" defaultChecked={contact.do_not_mail} />
          Do not mail (post)
        </label>
        <label className={`${label} sm:col-span-2`}>
          Notes
          <textarea name="notes" rows={3} defaultValue={contact.notes ?? ""} className={input} />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg"
          >
            Save details
          </button>
        </div>
      </form>

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
