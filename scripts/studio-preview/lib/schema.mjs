/*
 * What the mock needs to know about the database's shape, kept by hand.
 *
 * PostgREST learns relationships from foreign keys; the mock has no catalogue,
 * so the keys the studio's embeds follow are listed here (taken from
 * supabase/migrations). A column missing from this map simply cannot be
 * embedded through, and the request lands in the unanswered log.
 */

/** table → { column: referenced table }. Referenced column is always `id`. */
export const FOREIGN_KEYS = {
  appointment_types: { location_id: "locations" },
  appointments: { contact_id: "crm_contacts", appointment_type_id: "appointment_types" },
  categories: { parent_id: "categories" },
  consignment_items: { consignment_id: "consignments", piece_id: "piece_ref" },
  consignments: { counterparty_contact_id: "crm_contacts" },
  crm_campaign_recipients: { campaign_id: "crm_campaigns", contact_id: "crm_contacts" },
  crm_campaigns: { list_id: "crm_lists" },
  crm_contacts: { organization_id: "crm_organizations" },
  crm_interactions: { contact_id: "crm_contacts" },
  crm_interest_areas: { list_id: "crm_lists" },
  crm_list_members: { list_id: "crm_lists", contact_id: "crm_contacts" },
  document_pieces: { document_id: "piece_documents", piece_id: "piece_ref" },
  dp_requests: { contact_id: "crm_contacts" },
  email_events: {
    campaign_recipient_id: "crm_campaign_recipients",
    offer_recipient_id: "offer_recipients",
  },
  enquiries: { piece_id: "piece_ref", contact_id: "crm_contacts" },
  kyc_checks: { profile_id: "kyc_profiles" },
  kyc_documents: { profile_id: "kyc_profiles" },
  kyc_profiles: { contact_id: "crm_contacts" },
  legacy_filemaker_rows: { piece_id: "piece_ref" },
  offer_items: { offer_id: "offers", piece_id: "piece_ref" },
  offer_recipients: { offer_id: "offers", contact_id: "crm_contacts" },
  offer_views: { recipient_id: "offer_recipients" },
  piece_documents: { piece_id: "piece_ref" },
  piece_financials: {
    piece_id: "piece_ref",
    seller_contact_id: "crm_contacts",
    buyer_contact_id: "crm_contacts",
    consignment_id: "consignments",
    purchase_invoice_document_id: "piece_documents",
    sale_invoice_document_id: "piece_documents",
  },
  piece_image_squares: { image_id: "piece_images" },
  piece_images: { piece_id: "piece_ref" },
  piece_ledger_moves: { piece_id: "piece_ref" },
  piece_list_items: { list_id: "piece_lists", piece_id: "piece_ref" },
  piece_location_history: {
    piece_id: "piece_ref",
    from_location_id: "locations",
    to_location_id: "locations",
  },
  piece_shipments: { piece_id: "piece_ref", shipment_id: "shipments" },
  piece_watches: { piece_id: "piece_ref" },
  piece_flags: { piece_id: "piece_ref" },
  pieces: {
    maker_id: "makers",
    category_id: "categories",
    location_id: "locations",
    consignee_contact_id: "crm_contacts",
  },
  external_pieces: {
    maker_id: "makers",
    category_id: "categories",
    location_id: "locations",
    consignee_contact_id: "crm_contacts",
  },
  provenance_entries: { piece_id: "piece_ref" },
  purchase_gbp_cleared: { piece_id: "piece_ref" },
  shipment_documents: { shipment_id: "shipments" },
  unsubscribe_tokens: { contact_id: "crm_contacts" },
};

/**
 * Primary key per table, for upserts and for "single row" lookups. Anything
 * not listed keys on `id`.
 */
export const PRIMARY_KEYS = {
  crm_list_members: ["list_id", "contact_id"],
  document_pieces: ["document_id", "piece_id"],
  exchange_rates: ["base", "quote", "as_of"],
  piece_financials: ["piece_id"],
  piece_flags: ["user_id", "piece_id"],
  piece_image_squares: ["image_id"],
  piece_list_items: ["list_id", "piece_id"],
  piece_shipments: ["piece_id", "shipment_id"],
  piece_watches: ["user_id", "piece_id"],
  purchase_gbp_cleared: ["piece_id"],
  retention_policies: ["key"],
  sanity_assets: ["storage_path"],
  sanity_sync_state: ["entity_type", "entity_id"],
};

/** Tables whose `id` is a bigserial rather than a uuid. */
export const SERIAL_ID_TABLES = new Set([
  "activity_log",
  "sync_outbox",
  "email_events",
  "offer_views",
  "dp_retention_runs",
  "backup_runs",
]);

/**
 * Row-level security, coarsely. Staff cannot read these at all (admin and
 * accountant only in the real policies), so a staff session gets an empty
 * result, exactly as RLS would give it.
 */
export const STAFF_HIDDEN = new Set([
  "piece_financials",
  "purchase_gbp_cleared",
  "activity_log",
  "backup_runs",
  "dp_requests",
  "dp_breach_log",
  "dp_retention_runs",
  "retention_policies",
  "sanity_assets",
  "sanity_sync_state",
  "legacy_filemaker_rows",
  "legacy_value_mappings",
  "kyc_documents",
  "passkeys",
  "vw_stock_book",
  "vw_stock_book_standard",
  "vw_stock_book_zero_rated",
  "vw_stock_book_outside_scope",
  "vw_stock_book_all",
  "vw_contacts_for_review",
]);

/** Tables RLS scopes to the caller's own rows (user_id = auth.uid()). */
export const OWN_ROWS = {
  piece_flags: "user_id",
  piece_watches: "user_id",
  webauthn_credentials: "user_id",
};
