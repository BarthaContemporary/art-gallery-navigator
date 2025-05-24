
// Interface for Collection Websites
export interface CollectionWebsite {
  id: string;
  collection_id: string;
  name?: string | null;
  slug: string;
  password_hash?: string | null; // Will store hashed password
  show_prices: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Payload for creating a new collection website
export interface CreateCollectionWebsitePayload {
  collection_id: string;
  collection_name?: string; // Used for slug generation
  name?: string;
  password?: string; // Plain text password, will be hashed by Edge Function
  show_prices?: boolean;
  is_active?: boolean;
}

// Payload for updating an existing collection website
export interface UpdateCollectionWebsitePayload {
  id: string;
  collection_id: string; // Needed for invalidation
  name?: string;
  password?: string | null; // Plain text or null to remove. Undefined to not change.
  show_prices?: boolean;
  is_active?: boolean;
}

