
// Public-safe interface for Collection Websites (excludes password_hash)
export interface CollectionWebsite {
  id: string;
  collection_id: string;
  name?: string | null;
  slug: string;
  requires_password: boolean; // Whether password is required (replaces password_hash exposure)
  show_prices: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Admin interface that includes password_hash for internal use only
export interface CollectionWebsiteAdmin {
  id: string;
  collection_id: string;
  name?: string | null;
  slug: string;
  password_hash?: string | null;
  show_prices: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// For fetching all websites with their collection name (admin view)
export interface CollectionWebsiteWithCollectionName extends CollectionWebsiteAdmin {
  collection: {
    id: string;
    name: string;
  } | null;
}

// Payload for creating a new collection website
export interface CreateCollectionWebsitePayload {
  collection_id: string;
  collection_name?: string;
  name?: string;
  password?: string;
  show_prices?: boolean;
  is_active?: boolean;
}

// Payload for updating an existing collection website
export interface UpdateCollectionWebsitePayload {
  id: string;
  collection_id: string;
  name?: string;
  password?: string | null;
  show_prices?: boolean;
  is_active?: boolean;
}

