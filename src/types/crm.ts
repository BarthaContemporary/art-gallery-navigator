// CRM TypeScript Types

export type CRMContactType = 
  | 'collector' 
  | 'curator' 
  | 'press' 
  | 'institution' 
  | 'artist' 
  | 'advisor' 
  | 'vip' 
  | 'prospect' 
  | 'gallerist'
  | 'other';

export type CRMOrganizationType = 
  | 'gallery' 
  | 'museum' 
  | 'foundation' 
  | 'fair' 
  | 'press' 
  | 'corporation' 
  | 'auction_house' 
  | 'other';

export type CRMInteractionType = 
  | 'email' 
  | 'call' 
  | 'meeting' 
  | 'instagram_dm' 
  | 'whatsapp' 
  | 'wechat' 
  | 'line' 
  | 'note' 
  | 'task' 
  | 'other';

export type CRMInteractionDirection = 'inbound' | 'outbound' | 'internal';

export type CRMListType = 'static' | 'dynamic';

export type CRMCampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'archived';

export type CRMDealStatus = 'open' | 'won' | 'lost';

export interface CRMOrganization {
  id: string;
  name: string;
  type: CRMOrganizationType;
  website?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  vat_number?: string;
  vat_verified?: boolean;
  vat_verified_at?: string;
  eori_number?: string;
  eori_verified?: boolean;
  eori_verified_at?: string;
  company_number?: string;
  company_verified?: boolean;
  company_verified_at?: string;
  notes?: string;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CRMContact {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  secondary_email?: string;
  phone?: string;
  secondary_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  instagram_handle?: string;
  linkedin_handle?: string;
  whatsapp_number?: string;
  line_id?: string;
  wechat_id?: string;
  job_title?: string;
  organization_id?: string;
  organization?: CRMOrganization;
  contact_type: CRMContactType;
  status: string;
  source?: string;
  custom_fields: Record<string, any>;
  tags: string[];
  interested_artists: string[];
  marketing_consent: boolean;
  consent_date?: string;
  consent_source?: string;
  google_contact_id?: string;
  last_interaction_date?: string;
  birthday?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Profile image
  profile_image_url?: string;
  // Sanctions check fields
  sanctions_checked_at?: string;
  sanctions_risk_level?: string;
  sanctions_match_count?: number;
  sanctions_matches?: any[];
}

export interface CRMInteraction {
  id: string;
  contact_id: string;
  contact?: CRMContact;
  organization_id?: string;
  organization?: CRMOrganization;
  type: CRMInteractionType;
  direction: CRMInteractionDirection;
  subject?: string;
  summary?: string;
  notes?: string;
  interaction_date: string;
  duration_minutes?: number;
  gmail_thread_id?: string;
  gmail_message_id?: string;
  calendar_event_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CRMList {
  id: string;
  name: string;
  description?: string;
  type: CRMListType;
  filter_rules: Record<string, any>;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  member_count?: number;
}

export interface CRMListMember {
  id: string;
  list_id: string;
  contact_id: string;
  contact?: CRMContact;
  added_at: string;
  added_by?: string;
}

export interface CRMCampaign {
  id: string;
  name: string;
  description?: string;
  list_id?: string;
  list?: CRMList;
  audience_snapshot?: { contact_ids: string[] };
  subject?: string;
  preview_text?: string;
  from_name?: string;
  from_email?: string;
  status: CRMCampaignStatus;
  scheduled_at?: string;
  sent_at?: string;
  total_recipients: number;
  opens: number;
  clicks: number;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CRMPipeline {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  stages?: CRMPipelineStage[];
}

export interface CRMPipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  display_order: number;
  color: string;
  created_at: string;
}

// Deal-Contact junction for many-to-many relationship
export interface CRMDealContact {
  id: string;
  deal_id: string;
  contact_id: string;
  contact?: CRMContact;
  role?: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface CRMDeal {
  id: string;
  name: string;
  pipeline_id: string;
  stage_id?: string;
  stage?: CRMPipelineStage;
  contact_id?: string; // Deprecated: kept for backward compatibility
  contact?: CRMContact; // Deprecated: kept for backward compatibility  
  contacts?: CRMDealContact[]; // New: multiple contacts
  organization_id?: string;
  organization?: CRMOrganization;
  value?: number;
  currency: string;
  probability?: number;
  expected_close_date?: string;
  status: CRMDealStatus;
  related_artworks: string[];
  related_exhibitions?: string;
  notes?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CRMExportHistory {
  id: string;
  export_type: string;
  source_type: string;
  source_id?: string;
  source_name?: string;
  record_count?: number;
  google_sheet_id?: string;
  google_sheet_url?: string;
  exported_by?: string;
  exported_at: string;
}

export interface FilterRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty' | 'in' | 'not_in';
  value: string | string[] | number | boolean | null;
}

export interface FilterGroup {
  logic: 'and' | 'or';
  rules: (FilterRule | FilterGroup)[];
}

// Contact-Organization many-to-many relationship
export interface CRMContactOrganization {
  id: string;
  contact_id: string;
  organization_id: string;
  organization?: CRMOrganization;
  contact?: CRMContact;
  role?: string;
  is_primary: boolean;
  created_at: string;
}

// Deal-specific interaction/touchpoint
export type CRMDealInteractionType = 'email' | 'call' | 'meeting' | 'note' | 'other';

export interface CRMDealInteraction {
  id: string;
  deal_id: string;
  contact_id?: string;
  contact?: CRMContact;
  type: CRMDealInteractionType;
  direction?: CRMInteractionDirection;
  subject?: string;
  summary?: string;
  interaction_date: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
