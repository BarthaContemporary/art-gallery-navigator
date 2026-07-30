/**
 * Domain types for the JVB system.
 *
 * These mirror supabase/migrations. Once a database is running, regenerate
 * machine types with `pnpm db:types` and narrow these against them.
 */

export type UserRole = "admin" | "staff" | "accountant";

export type PieceStatus =
  | "in_stock"
  | "reserved"
  | "consigned_in"
  | "consigned_out"
  | "sold"
  | "gifted"
  | "returned"
  | "written_off";

export type VatTreatment =
  | "margin_scheme"
  | "standard"
  | "zero_rated"
  | "outside_scope";

export type ImageRole =
  | "front"
  | "back"
  | "side"
  | "signature"
  | "box"
  | "detail"
  | "condition"
  | "document";

export type OfferKind = "offer" | "fair_preview" | "viewing_room";

export type DocType =
  | "purchase_invoice"
  | "sale_invoice"
  | "certificate"
  | "export_licence"
  | "condition_report"
  | "provenance_document"
  | "correspondence"
  | "shipping"
  | "insurance"
  | "other";

export type LocationType =
  | "gallery"
  | "storage"
  | "fair"
  | "restorer"
  | "consignee"
  | "auction"
  | "other";

export interface Maker {
  id: string;
  display_name: string;
  native_name: string | null;
  romanized_name: string | null;
  alt_names: string[];
  school_or_workshop: string | null;
  life_dates: string | null;
  region: string | null;
  biography: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
}

export interface StockLocation {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  notes: string | null;
}

export interface Piece {
  id: string;
  stock_number: string;
  legacy_stock_number: string | null;
  legacy_stock_number_conflict: boolean;
  title: string | null;
  maker_id: string | null;
  attribution_qualifier: string | null;
  category_id: string | null;
  medium: string | null;
  period: string | null;
  origin_region: string | null;
  description: string | null;
  condition_report: string | null;
  signature_inscription: string | null;
  box_type: string | null;
  box_notes: string | null;
  height_cm: number | null;
  width_cm: number | null;
  depth_cm: number | null;
  length_cm: number | null;
  diameter_cm: number | null;
  weight_g: number | null;
  /**
   * @deprecated Retired legacy column — FileMaker's verbatim dimension text.
   * Nothing reads or writes it; the column is kept only so the imported text
   * is not destroyed. Use formatDimensionsCm() over the numeric fields above.
   */
  dimensions_display: string | null;
  status: PieceStatus;
  location_id: string | null;
  photographer: string | null;
  comments: string | null;
  tags: string[];
  ai_suggestions: Record<string, unknown> | null;
  web_visible: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PieceFinancials {
  piece_id: string;
  purchase_date: string | null;
  purchase_cost: number | null;
  purchase_currency: string;
  purchase_fx: number;
  purchase_cost_gbp: number | null;
  purchase_invoice_document_id: string | null;
  seller_contact_id: string | null;
  restoration_cost_gbp: number;
  other_costs_gbp: number;
  total_cost_gbp: number | null;
  marked_price_gbp: number | null;
  sold_date: string | null;
  sold_price: number | null;
  sell_currency: string;
  sell_fx: number;
  sold_price_gbp: number | null;
  sale_invoice_document_id: string | null;
  buyer_contact_id: string | null;
  vat_treatment: VatTreatment;
  vat_review_needed: boolean;
  consignment_id: string | null;
  margin_gbp: number | null;
  margin_pct: number | null;
  updated_at: string;
}

export interface PieceImage {
  id: string;
  piece_id: string;
  role: ImageRole;
  caption: string | null;
  sort_order: number;
  storage_path_original: string | null;
  storage_path_display: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  exif: Record<string, unknown> | null;
  processing_status: "pending" | "processing" | "done" | "error";
  processing_error: string | null;
  legacy_container_filename: string | null;
  created_at: string;
}

export interface PieceDocument {
  id: string;
  piece_id: string;
  doc_type: DocType;
  title: string;
  storage_path: string;
  issued_by: string | null;
  issued_date: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ProvenanceEntry {
  id: string;
  piece_id: string;
  sort_order: number;
  date_text: string | null;
  party: string | null;
  event_type: "acquired" | "collection" | "auction" | "exhibited" | "published" | "other";
  details: string | null;
  is_public: boolean;
}

export interface LocationHistoryEntry {
  id: string;
  piece_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  moved_at: string;
  moved_by: string | null;
  note: string | null;
}

export interface ActivityEntry {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface CrmContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  organization_id: string | null;
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
  interested_regions: string[];
  custom_fields: Record<string, unknown>;
  marketing_consent: boolean;
  consent_date: string | null;
  consent_source: string | null;
  do_not_mail: boolean;
  unsubscribed_at: string | null;
  kyc_status: "not_started" | "pending" | "verified" | "refer" | "rejected";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  title: string;
  kind: OfferKind;
  intro: string | null;
  show_prices: boolean;
  expires_at: string | null;
  status: "draft" | "sent" | "archived";
  created_by: string | null;
  created_at: string;
}

export interface OfferRecipient {
  id: string;
  offer_id: string;
  contact_id: string;
  token: string;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  response: "interested" | "declined" | null;
}
