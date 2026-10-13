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
