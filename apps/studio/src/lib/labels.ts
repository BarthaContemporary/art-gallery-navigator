/**
 * The words the studio shows for stored enum values: one map per enum, so a
 * state never reads as three different words on three pages (a work was
 * "Available" in the table, "in stock" in the editor).
 *
 * Keys are the values stored in the database and posted by forms, and must
 * never change here; only the words may. Key order is the order the values
 * are offered in a select, so `Object.entries(MAP)` builds the options.
 *
 * Plain data with no imports, so client and server components can both use
 * it.
 */

/** pieces.status. Re-exported from components/status-pill for older imports. */
export const STATUS_LABELS: Record<string, string> = {
  in_stock: "Available",
  reserved: "Reserved",
  consigned_in: "Consigned in",
  consigned_out: "Consigned out",
  sold: "Sold",
  gifted: "Gifted",
  returned: "Returned",
  written_off: "Written off",
};

/**
 * The state colours a value may take (spec R4). A tone always travels with
 * its word: the Badge component prints the label beside or inside it.
 */
export type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

/**
 * pieces.status as a tone. Colour only where it asks for something: ok for
 * a work that can be offered, warn for one held for a client, info for one
 * whose ownership sits with someone else. Settled states (sold, gifted,
 * returned, written off) stay neutral; danger is kept for errors.
 */
export const STATUS_TONES: Record<string, Tone> = {
  in_stock: "ok",
  reserved: "warn",
  consigned_in: "info",
  consigned_out: "info",
  sold: "neutral",
  gifted: "neutral",
  returned: "neutral",
  written_off: "neutral",
};

/**
 * piece_documents.doc_type (the doc_type enum). The short words the Documents
 * filters always used: the context already says "document", and they fit a
 * chip or a table cell.
 */
export const DOC_TYPE_LABELS: Record<string, string> = {
  purchase_invoice: "Purchase invoice",
  sale_invoice: "Sale invoice",
  provenance_document: "Provenance",
  correspondence: "Correspondence",
  shipping: "Shipping",
  insurance: "Insurance",
  certificate: "Certificate",
  condition_report: "Condition report",
  export_licence: "Export licence",
  import_document: "Import documents",
  other: "Other",
};

/** offers.kind (the offer_kind enum). */
export const OFFER_KIND_LABELS: Record<string, string> = {
  offer: "Offer",
  fair_preview: "Fair preview",
  viewing_room: "Viewing room",
};

/** shipments.kind (the shipment_kind enum). */
export const SHIPMENT_KIND_LABELS: Record<string, string> = {
  import: "Import",
  temporary_import: "Temporary import",
  export: "Export",
  temporary_export: "Temporary export",
};

/** crm_contacts.contact_type. */
export const CONTACT_TYPE_LABELS: Record<string, string> = {
  collector: "Collector",
  museum: "Museum",
  dealer: "Dealer",
  auction_house: "Auction house",
  shipper: "Shipper",
  restorer: "Restorer",
  press: "Press",
};

/** crm_contacts.kyc_status: the in-house AML check. */
export const KYC_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  pending: "In progress",
  verified: "Confirmed",
  refer: "Refer",
  rejected: "Rejected",
};

/**
 * crm_contacts.kyc_status as a tone. Marked only where the check asks
 * something of the gallery: under way (info), referred or rejected (warn,
 * flagged before any sale). Not started is the resting state of most
 * contacts and stays neutral, so the column does not shout on every row.
 */
export const KYC_STATUS_TONES: Record<string, Tone> = {
  not_started: "neutral",
  pending: "info",
  verified: "ok",
  refer: "warn",
  rejected: "warn",
};

/** piece_financials.vat_treatment (the vat_treatment enum). */
export const VAT_TREATMENT_LABELS: Record<string, string> = {
  margin_scheme: "Margin scheme",
  standard: "Standard",
  zero_rated: "Zero-rated",
  outside_scope: "Outside scope",
};

/** pieces.presentation: the editor's "Website square" select, in short. */
export const PRESENTATION_LABELS: Record<string, string> = {
  auto: "Auto",
  flat: "Flat work",
  object: "Object",
  photo: "Photograph as taken",
};

/** pieces.ledger: the register a work is held in. */
export const LEDGER_LABELS: Record<string, string> = {
  jvb: "JvdB",
  external: "Not JvdB",
};

/** piece_financials.import_type: the editor's "Type of import" select. */
export const IMPORT_TYPE_LABELS: Record<string, string> = {
  import_vat_paid: "Import VAT paid",
  import_vat_deferred: "Import VAT deferred",
  temporary_import: "Temporary import",
};

/** activity_log.action: what happened to a record. */
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  INSERT: "Created",
  UPDATE: "Edited",
  DELETE: "Deleted",
};

/** activity_log.entity_type (a table name): what kind of record it was. */
export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  pieces: "Record",
  external_pieces: "Record",
  piece_financials: "Financials",
  piece_images: "Image",
  piece_lists: "List",
  makers: "Maker",
  categories: "Category",
  locations: "Location",
  crm_contacts: "Contact",
  crm_lists: "Contact list",
  crm_campaigns: "Newsletter",
  offers: "Offer",
  appointments: "Appointment",
  shipments: "Shipment",
  documents: "Document",
  user_roles: "User role",
};

/**
 * Column names of a work (pieces, external_pieces) and its financials
 * (piece_financials) in the words of the editor's fields, for the change
 * history. A column missing here still reads as words through labelOf().
 */
export const FIELD_LABELS: Record<string, string> = {
  // the record
  stock_number: "Stock number",
  legacy_stock_number: "Legacy stock number",
  legacy_stock_number_conflict: "Legacy number conflict",
  title: "Title",
  year: "Year",
  maker_id: "Maker",
  attribution_qualifier: "Attribution",
  category_id: "Category",
  medium: "Medium",
  period: "Period",
  origin_region: "Origin / region",
  status: "Status",
  presentation: "Website square",
  web_visible: "On website",
  needs_completion: "Needs cataloguing",
  description: "Description",
  condition_report: "Condition",
  signature_inscription: "Signature / inscription",
  box_type: "Box (tomobako)",
  box_notes: "Box notes",
  framed: "Framed",
  height_cm: "Height cm",
  width_cm: "Width cm",
  depth_cm: "Depth cm",
  length_cm: "Length cm",
  diameter_cm: "Diameter cm",
  weight_g: "Weight g",
  unframed_height_cm: "Unframed height cm",
  unframed_width_cm: "Unframed width cm",
  unframed_depth_cm: "Unframed depth cm",
  unframed_length_cm: "Unframed length cm",
  unframed_diameter_cm: "Unframed diameter cm",
  unframed_weight_g: "Unframed weight g",
  dimensions_display: "Dimensions as entered",
  location_id: "Location",
  comments: "Internal comments",
  photographer: "Photographer",
  tags: "Tags",
  ai_suggestions: "Suggestions",
  sold_to: "Buyer note",
  source_note: "Source / acquired from",
  purchased_from: "Purchased from",
  publications: "Publications",
  exhibitions: "Past exhibitions",
  published_note: "Publication note",
  document_note: "Document note",
  shares_note: "Co-owner / consignee",
  consignee_contact_id: "Co-owner / consignee contact",
  consignment_details: "Consignment notes",
  consignment_share_pct: "Share / commission (%)",
  sale_handled_by_jvb: "Sale handled by J.v.d.B.",
  ledger: "Register",
  legacy_modified_at: "FileMaker last modified",
  legacy_modified_by: "FileMaker modified by",
  deleted_at: "Moved to trash",
  created_at: "Created",
  updated_at: "Updated",
  created_by: "Created by",
  updated_by: "Updated by",
  // the financials
  purchase_date: "Purchase date",
  purchase_cost: "Purchase cost",
  purchase_currency: "Purchase currency",
  purchase_fx: "Purchase rate",
  purchase_cost_gbp: "Purchase cost £",
  purchase_invoice_document_id: "Purchase invoice",
  seller_contact_id: "Seller",
  restoration_cost_gbp: "Restoration £",
  other_costs_gbp: "Other costs £",
  total_cost_gbp: "Total cost £",
  marked_price_gbp: "Marked price £",
  sold_date: "Sold date",
  sold_price: "Sold price",
  sell_currency: "Sell currency",
  sell_fx: "Sell rate",
  sold_price_gbp: "Sold £",
  sale_invoice_document_id: "Sale invoice",
  buyer_contact_id: "Buyer",
  vat_treatment: "VAT treatment",
  vat_review_needed: "VAT review needed",
  consignment_id: "Consignment",
  margin_gbp: "Margin £",
  import_type: "Type of import",
  import_vat_gbp: "Import VAT paid £",
  legacy_profit_gbp: "Legacy profit £",
  net_profit_gbp: "Net profit £",
};

/**
 * The word maps for columns that hold an enum value, so the change history
 * prints "Available", not in_stock.
 */
export const FIELD_VALUE_LABELS: Record<string, Record<string, string>> = {
  status: STATUS_LABELS,
  vat_treatment: VAT_TREATMENT_LABELS,
  presentation: PRESENTATION_LABELS,
  ledger: LEDGER_LABELS,
  import_type: IMPORT_TYPE_LABELS,
};

/** locations.type, in the order the Locations page offers them. */
export const LOCATION_TYPE_LABELS: Record<string, string> = {
  gallery: "Gallery",
  storage: "Storage",
  fair: "Fair",
  restorer: "Restorer",
  consignee: "Consignee",
  auction: "Auction",
  other: "Other",
};

/** A location as the studio names it: "Name · CODE", or the code alone. */
export function locationLabel(l: { code: string; name: string | null }): string {
  return l.name && l.name !== l.code ? `${l.name} · ${l.code}` : l.code;
}

/**
 * The word for `value` in `labels`. A value the map does not know yet (a new
 * enum value added before its label) still reads as words, in sentence case,
 * rather than as a snake_case key; an empty value prints the em dash.
 */
export function labelOf(labels: Record<string, string>, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const known = labels[value];
  if (known) return known;
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
