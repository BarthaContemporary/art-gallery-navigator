
import type { Database } from '@/integrations/supabase/types';

// Define a type for table names based on the Database schema
export type TableName = keyof Database['public']['Tables'];

export const TABLES_TO_EXPORT: TableName[] = [
  'artists', 'artworks', 'artwork_images', 'collections', 'collection_artworks',
  'collection_websites', 'documents', 'locations', 'projects', 'project_users',
  'project_tasks', 'project_task_references', 'clients', 'sales', 'exhibitions',
  'exhibition_artworks', 'profiles', 'user_roles', 'uploads'
  // 'deletion_requests' was causing an issue with the generated types, temporarily removed.
  // Needs to be verified if 'deletion_requests' table is fully defined in types.ts
];

export const TABLES_FOR_CSV_EXPORT: TableName[] = [
  'artists', 'artworks', 'collections', 'documents', 'locations', 'projects', 'clients', 'sales', 'exhibitions', 'uploads'
];

