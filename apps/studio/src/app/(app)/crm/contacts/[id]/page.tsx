import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  getSupabase,
  getSession,
  canSeeFinancials,
  createServiceClient,
  hasRole,
} from "@/lib/supabase";
import { ContactEditor, type Purchase, type Consignment } from "@/components/contact-editor";
import { DataProtectionPanel } from "@/components/data-protection-panel";
import { consignmentSplit } from "@/lib/consignment";
import { loadPieceRows } from "@/lib/piece-store";
// London dates: this page renders on the server, where the zone is UTC.
import { EMPTY, formatDate } from "@/lib/format";
import {
  CONTACT_TYPE_LABELS,
  KYC_STATUS_LABELS,
  KYC_STATUS_TONES,
  labelOf,
} from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

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

/** crm_contacts.sanctions_status, as the fortnightly screen writes it. */
const SANCTIONS_LABELS: Record<string, string> = {
  clear: "Clear",
  potential_match: "Potential match",
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
    .select(
      "piece_id, sold_date, sold_price_gbp",
    )
    .eq("buyer_contact_id", id)
    .order("sold_date", { ascending: false, nullsFirst: false });
  const purchasedPieces = await loadPieceRows<{
    id: string;
    stock_number: string | null;
    title: string | null;
    year: string | null;
    sold_to: string | null;
    maker_name: string | null;
  }>(
    svc,
    ((purRows ?? []) as { piece_id: string }[]).map((r) => r.piece_id),
    "id, stock_number, title, year, sold_to, maker_name",
  );
  const purchases: Purchase[] = (purRows ?? []).map((r) => {
    const raw = r as unknown as {
      piece_id: string;
      sold_date: string | null;
      sold_price_gbp: number | null;
    };
    const found = purchasedPieces.get(raw.piece_id);
    const row = {
      sold_date: raw.sold_date,
      sold_price_gbp: raw.sold_price_gbp,
      piece: found
        ? { ...found, maker: { display_name: found.maker_name } }
        : null,
    };
    return {
      stock_number: row.piece?.stock_number ?? null,
      title: row.piece?.title ?? null,
      year: row.piece?.year ?? null,
      maker_name: row.piece?.maker?.display_name ?? null,
      buyer_note: row.piece?.sold_to ?? null,
      sold_date: row.sold_date ?? null,
      // Never serialize the price to a non-privileged client: this prop is
      // sent to a "use client" component, so a staff user (denied
      // piece_financials by RLS) could otherwise read it from the flight payload.
      sold_price_gbp: showPrices ? row.sold_price_gbp ?? null : null,
    };
  });

  // Consignments: works where this contact is the co-owner / consignee. Read
  // via the service client so all staff see the work; this contact's share £ is
  // only computed/serialised for admin/accountant (showPrices).
  // Queried per stock table rather than through the union view because of the
  // maker and financials embeds, which PostgREST resolves from foreign keys on
  // a real table.
  const CONSIGNMENT_COLUMNS =
    "stock_number, title, year, consignment_share_pct, sale_handled_by_jvb, maker:makers ( display_name ), fin:piece_financials ( sold_date, sold_price_gbp, purchase_cost_gbp, restoration_cost_gbp, other_costs_gbp, vat_treatment, import_type, import_vat_gbp )";
  const consResults = await Promise.all(
    (["pieces", "external_pieces"] as const).map((table) =>
      svc.from(table).select(CONSIGNMENT_COLUMNS).eq("consignee_contact_id", id),
    ),
  );
  const consRows = consResults.flatMap((r) => r.data ?? []);
  const num0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const consignments: Consignment[] = ((consRows ?? []) as unknown as {
    stock_number: string | null;
    title: string | null;
    year: string | null;
    consignment_share_pct: number | null;
    sale_handled_by_jvb: boolean | null;
    maker: { display_name: string | null } | null;
    fin: {
      sold_date: string | null;
      sold_price_gbp: number | null;
      purchase_cost_gbp: number | null;
      restoration_cost_gbp: number | null;
      other_costs_gbp: number | null;
      vat_treatment: string | null;
      import_type: string | null;
      import_vat_gbp: number | null;
    }[] | null;
  }[]).map((r) => {
    const f = r.fin?.[0] ?? null;
    let coOwnerShare: number | null = null;
    if (showPrices && f?.sold_date && r.consignment_share_pct != null) {
      coOwnerShare = consignmentSplit({
        amount: num0(f.sold_price_gbp),
        vatTreatment: f.vat_treatment ?? "margin_scheme",
        saleHandledByJvb: r.sale_handled_by_jvb,
        purchaseCostGbp: num0(f.purchase_cost_gbp),
        extraCostsGbp: num0(f.restoration_cost_gbp) + num0(f.other_costs_gbp),
        importVatPaidGbp: f.import_type === "import_vat_paid" ? num0(f.import_vat_gbp) : 0,
        sharePct: r.consignment_share_pct,
      }).coOwnerShare;
    }
    return {
      stock_number: r.stock_number ?? null,
      title: r.title ?? null,
      year: r.year ?? null,
      maker_name: r.maker?.display_name ?? null,
      share_pct: r.consignment_share_pct ?? null,
      sale_handled_by_jvb: r.sale_handled_by_jvb ?? null,
      sold_date: f?.sold_date ?? null,
      co_owner_share_gbp: coOwnerShare,
    };
  });

  const name =
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "Unnamed contact";
  const amlDate =
    typeof contact.custom_fields?.aml_confirmed_date === "string"
      ? (contact.custom_fields.aml_confirmed_date as string).trim()
      : "";
  // The editor stores a calendar day ("2026-10-03"), shown as "3 Oct 2026".
  // The field is free text in older and imported records, so anything that is
  // not an ISO date is shown as it was entered rather than as a dash, and
  // never re-read as a guessed date.
  const amlDateFormatted = /^\d{4}-\d{2}-\d{2}/.test(amlDate) ? formatDate(amlDate) : EMPTY;
  const amlDateShown = amlDateFormatted !== EMPTY ? amlDateFormatted : amlDate;

  // Right to erasure (Art. 17) with the legal holds the database knows about:
  // erase_contact() hard-deletes when nothing must be kept and pseudonymises
  // when AML or accounting records apply. Admin only, re-checked here because
  // a Server Action is independently callable.
  const { data: holdRows } = await svc.rpc("contact_legal_holds", { _contact: id });
  const holds = (holdRows ?? []) as string[];
  const isAdmin = hasRole(session?.roles ?? [], "admin");

  async function eraseContact() {
    "use server";
    const s = await getSession();
    if (!s || !hasRole(s.roles, "admin")) throw new Error("Forbidden");
    const db = createServiceClient();
    await db.from("dp_requests").update({ completed_at: new Date().toISOString(), outcome: "Erased" }).eq("contact_id", id).eq("kind", "erasure").is("completed_at", null);
    const { data, error } = await db.rpc("erase_contact", { _contact: id });
    if (error) throw new Error(error.message);
    const mode = (data as { mode?: string } | null)?.mode;
    if (mode === "deleted") redirect("/crm/contacts");
    redirect(`/crm/contacts/${id}`);
  }

  async function logRequest(formData: FormData) {
    "use server";
    const s = await getSession();
    if (!s || !hasRole(s.roles, "admin")) throw new Error("Forbidden");
    const db = createServiceClient();
    const received = String(formData.get("received_at") ?? "") || new Date().toISOString().slice(0, 10);
    const due = new Date(received);
    due.setMonth(due.getMonth() + 1);
    await db.from("dp_requests").insert({
      contact_id: id,
      subject_name: name,
      kind: String(formData.get("kind") ?? "other"),
      channel: String(formData.get("channel") ?? "").trim() || null,
      received_at: received,
      due_at: due.toISOString().slice(0, 10),
      created_by: s.user.id,
    });
    revalidatePath(`/crm/contacts/${id}`);
  }

  // The sanctions screen's last answer (api/cron/sanctions-screen): a
  // potential match is flagged for review, a clear result stays neutral.
  const sanctions = contact.sanctions_status;
  const kycTone = KYC_STATUS_TONES[contact.kyc_status] ?? "neutral";

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/crm/contacts", label: "All contacts" }}
        title={name}
        meta={[labelOf(CONTACT_TYPE_LABELS, contact.contact_type), contact.email].filter(Boolean).join(" · ")}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={kycTone}>
            AML: {labelOf(KYC_STATUS_LABELS, contact.kyc_status)}
            {amlDateShown ? `, ${amlDateShown}` : ""}
          </Badge>
          {sanctions ? (
            <Badge tone={sanctions === "potential_match" ? "warn" : "neutral"}>
              Sanctions: {labelOf(SANCTIONS_LABELS, sanctions)}
              {contact.last_screened_at ? `, screened ${formatDate(contact.last_screened_at)}` : ""}
            </Badge>
          ) : null}
        </div>
      </PageHeader>

      {/* A potential sanctions match is the most serious state a contact can
          be in, so besides the tag it gets a notice of its own, announced as
          an alert. It states the screen's result and points to the AML
          section; what to do about a match is the gallery's AML procedure,
          not this page's to set. Drawn with the shared .notice look: Notice
          itself gives a warn tone role="status", and this one must be an
          alert. */}
      {sanctions === "potential_match" ? (
        <div role="alert" data-tone="warn" className="notice mb-6">
          <p className="min-w-0 flex-1">
            Possible match on the UK sanctions list
            {contact.last_screened_at ? ` (screened ${formatDate(contact.last_screened_at)})` : ""}. Check it
            before any offer, sale or shipment for this contact.
          </p>
          <a href="#aml" className="shrink-0 text-ink underline underline-offset-2">
            Go to AML
          </a>
        </div>
      ) : null}

      <ContactEditor
        id={id}
        contact={contact}
        purchases={purchases}
        consignments={consignments}
        interestOptions={interestOptions}
        showPrices={showPrices}
      />

      {isAdmin ? (
        <DataProtectionPanel
          contactId={id}
          holds={holds}
          erased={Boolean((contact as { erased_at?: string | null }).erased_at)}
          eraseAction={eraseContact}
          logRequestAction={logRequest}
        />
      ) : null}
    </div>
  );
}
