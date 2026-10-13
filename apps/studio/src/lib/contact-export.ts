import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPieceRows } from "@/lib/piece-store";
import { resolveListContactIds, type CrmListLike } from "@/lib/crm-list-members";

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
  /** Each opening of a private-offer page: when, from which IP, in which browser. */
  offer_views: Record<string, unknown>[];
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
    { data: interactions }, { data: lists }, { data: liveLists }, { data: recips }, { data: offers },
    { data: enquiries }, { data: appointments }, { data: purchases }, { data: sales },
    { data: consignments }, { data: kyc }, { data: requests }, { data: holds },
  ] = await Promise.all([
    svc.from("crm_interactions").select("kind, note, happened_at").eq("contact_id", id).order("happened_at"),
    // Curated lists only: a live list (the areas of interest among them)
    // stores no member rows, so its membership is resolved below.
    svc.from("crm_list_members").select("list:crm_lists(name)").eq("contact_id", id),
    svc.from("crm_lists").select("id, name, is_dynamic, filter_rules").eq("is_dynamic", true).order("name"),
    svc.from("crm_campaign_recipients").select("status, created_at, opened_at, clicked_at, bounced_at, campaign:crm_campaigns(subject, sent_at)").eq("contact_id", id).order("created_at"),
    // offer_views logs IP and browser per page opening (retention row
    // 'offer_views'), so it is personal data and belongs in the export.
    svc.from("offer_recipients").select("sent_at, first_viewed_at, view_count, response, responded_at, offer:offers(title, created_at), views:offer_views(viewed_at, ip, user_agent)").eq("contact_id", id).order("sent_at"),
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

  const curatedNames = ((lists ?? []) as { list: { name: string } | { name: string }[] | null }[])
    .map((l) => (Array.isArray(l.list) ? l.list[0]?.name : l.list?.name))
    .filter((n): n is string => Boolean(n));
  // Live lists the contact currently falls in, resolved through the same
  // module every list page uses, so the export names exactly the lists the
  // studio shows them in. One list at a time: a handful of reads, and a SAR
  // is rare. A failed read throws rather than leaving a list out unnoticed.
  const liveNames: string[] = [];
  for (const l of (liveLists ?? []) as (CrmListLike & { name: string })[]) {
    if ((await resolveListContactIds(svc, l)).includes(id)) liveNames.push(l.name);
  }

  // Views are split out of the offer rows into one flat, dated list.
  type OfferView = { viewed_at: string; ip: string | null; user_agent: string | null };
  type OfferRow = Record<string, unknown> & {
    offer: { title: string | null } | { title: string | null }[] | null;
    views?: OfferView[] | null;
  };
  const offerRows = (offers ?? []) as OfferRow[];
  const offerViews = offerRows
    .flatMap((o) => {
      const title = (Array.isArray(o.offer) ? o.offer[0]?.title : o.offer?.title) ?? null;
      return (o.views ?? []).map((v) => ({
        offer: title,
        viewed_at: v.viewed_at,
        ip_address: v.ip,
        browser: v.user_agent,
      }));
    })
    .sort((a, b) => a.viewed_at.localeCompare(b.viewed_at));

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
    lists: [...new Set([...curatedNames, ...liveNames])],
    newsletters: (recips ?? []) as Record<string, unknown>[],
    offers: offerRows.map((o) => ({ ...o, views: undefined })),
    offer_views: offerViews,
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
