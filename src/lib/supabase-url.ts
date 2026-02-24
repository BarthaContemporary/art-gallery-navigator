/**
 * Centralized Supabase URL utilities.
 * Use these instead of hardcoding the Supabase project URL.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://cvhdspyugfcvkrufqzrq.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y";

/** Base Supabase project URL */
export const getSupabaseUrl = (): string => SUPABASE_URL;

/** Supabase anon/publishable key */
export const getSupabaseAnonKey = (): string => SUPABASE_ANON_KEY;

/** Get a Supabase Edge Function URL */
export const getEdgeFunctionUrl = (functionName: string): string =>
  `${SUPABASE_URL}/functions/v1/${functionName}`;

/** Get a Supabase Storage public URL */
export const getStoragePublicUrl = (bucket: string, path: string): string =>
  `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

/** Get a Supabase Storage object URL (for authenticated uploads) */
export const getStorageObjectUrl = (bucket: string, path: string): string =>
  `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

/** Get the Supabase REST API URL */
export const getRestUrl = (table: string): string =>
  `${SUPABASE_URL}/rest/v1/${table}`;
