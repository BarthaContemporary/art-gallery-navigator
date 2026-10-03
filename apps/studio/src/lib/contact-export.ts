import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPieceRows } from "@/lib/piece-store";

/**
 * Everything the system holds about one contact, assembled for a subject
 * access request (UK GDPR Art. 15) or a portability request (Art. 20).
 * Read with the service client after an admin check: the point is the
 * complete picture, including role-restricted purchase records, which are the
 * requester's own data.
 */
export type ContactExport = {
  exported_at: string;
  contact: Record<string, unknown>;
  consent: Record<string, unknown>;
  interactions: Record<string, unknown>[];
  lists: string[];
  newsletters: Record<string, unknown>[];
  offers: Record<string, unknown>[];
  enquiries: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  sales_to_gallery: Record<string, unknown>[];
  consignments: Record<string, unknown>[];
  aml: Record<string, unknown>[];
  requests: Record<string, unknown>[];
  legal_holds: string[];
};

const CONTACT_FIELDS = [
  "first_name", "last_name", "salutation", "contact_type", "email", "phone",
  "address_line1", "address_line2", "city", "postcode", "country",
  "instagram_handle", "whatsapp_number", "line_id", "wechat_id",
  "tags", "interested_regions", "custom_fields", "notes", "kyc_status",
  "sanctions_status", "last_screened_at", "created_at", "updated_at",
];

export async function buildContactExport(svc: SupabaseClient, id: string): Promise<ContactExport | null> {
  const { data: c } = await svc.from("crm_contacts").select("*").eq("id", id).maybeSingle();
  if (!c) return null;
  const row = c as Record<string, unknown>;

  const [
    { data: interactions }, { data: lists }, { data: recips }, { data: offers },
    { data: enquiries }, { data: appointments }, { data: purchases }, { data: sales },
    { data: consignments }, { data: kyc }, { data: requests }, { data: holds },
  ] = await Promise.all([
    svc.from("crm_interactions").select("kind, note, happened_at").eq("contact_id", id).order("happened_at"),
    svc.from("crm_list_members").select("list:crm_lists(name)").eq("contact_id", id),
    svc.from("crm_campaign_recipients").select("status, created_at, opened_at, clicked_at, bounced_at, campaign:crm_campaigns(subject, sent_at)").eq("contact_id", id).order("created_at"),
    svc.from("offer_recipients").select("sent_at, first_viewed_at, view_count, response, responded_at, offer:offers(title, created_at)").eq("contact_id", id).order("sent_at"),
    svc.from("enquiries").select("channel, message, status, created_at, piece_id").eq("contact_id", id).order("created_at"),
    svc.from("appointments").select("starts_at, ends_at, status, notes, created_at").eq("contact_id", id).order("starts_at"),
    svc.from("piece_financials").select("piece_id, sold_date, sold_price_gbp, sell_currency, sold_price").eq("buyer_contact_id", id),
    svc.from("piece_financials").select("piece_id, purchase_date, purchase_cost_gbp, purchase_currency, purchase_cost").eq("seller_contact_id", id),
    svc.from("consignments").select("direction, start_date, end_date, revenue_split_pct, terms").eq("counterparty_contact_id", id),
    svc.from("kyc_profiles").select("status, risk_rating, verified_at, expires_at, provider, created_at, checks:kyc_checks(check_type, provider, result, checked_at)").eq("contact_id", id),
    svc.from("dp_requests").select("kind, received_at, due_at, completed_at, outcome").eq("contact_id", id).order("received_at"),
    svc.rpc("contact_legal_holds", { _contact: id }),
  ]);

  const pieceIds = [
    ...((purchases ?? []) as { piece_id: string }[]).map((p) => p.piece_id),
    ...((sales ?? []) as { piece_id: string }[]).map((p) => p.piece_id),
    ...((enquiries ?? []) as { piece_id: string | null }[]).map((e) => e.piece_id).filter((v): v is string => Boolean(v)),
  ];
  const pieces = await loadPieceRows<{ id: string; stock_number: string | null; title: string | null; maker_name: string | null }>(
    svc, pieceIds, "id, stock_number, title, maker_name",
  );
  const work = (pid: string | null) => {
    const p = pid ? pieces.get(pid) : undefined;
    return p ? { stock_number: p.stock_number, title: p.title, maker: p.maker_name } : null;
  };

  const contact: Record<string, unknown> = {};
  for (const k of CONTACT_FIELDS) if (row[k] !== null && row[k] !== undefined) contact[k] = row[k];

  return {
    exported_at: new Date().toISOString(),
    contact,
    consent: {
      marketing_consent: row.marketing_consent,
      consent_date: row.consent_date,
      consent_source: row.consent_source,
      unsubscribed_at: row.unsubscribed_at,
      do_not_mail: row.do_not_mail,
      email_bounced_at: row.email_bounced_at,
      evidence: row.consent_evidence ?? null,
    },
    interactions: (interactions ?? []) as Record<string, unknown>[],
    lists: ((lists ?? []) as { list: { name: string } | { name: string }[] | null }[])
      .map((l) => (Array.isArray(l.list) ? l.list[0]?.name : l.list?.name))
      .filter((n): n is string => Boolean(n)),
    newsletters: (recips ?? []) as Record<string, unknown>[],
    offers: (offers ?? []) as Record<string, unknown>[],
    enquiries: ((enquiries ?? []) as Record<string, unknown>[]).map((e) => ({ ...e, work: work(e.piece_id as string | null), piece_id: undefined })),
    appointments: (appointments ?? []) as Record<string, unknown>[],
    purchases: ((purchases ?? []) as Record<string, unknown>[]).map((p) => ({ ...p, work: work(p.piece_id as string), piece_id: undefined })),
    sales_to_gallery: ((sales ?? []) as Record<string, unknown>[]).map((p) => ({ ...p, work: work(p.piece_id as string), piece_id: undefined })),
    consignments: (consignments ?? []) as Record<string, unknown>[],
    aml: (kyc ?? []) as Record<string, unknown>[],
    requests: (requests ?? []) as Record<string, unknown>[],
    legal_holds: (holds ?? []) as string[],
  };
}
