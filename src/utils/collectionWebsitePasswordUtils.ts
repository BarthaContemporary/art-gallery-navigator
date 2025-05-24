
import { supabase } from "@/integrations/supabase/client";

/**
 * Hashes a password using the 'hash-collection-password' Supabase Edge Function.
 * @param password The plain text password to hash.
 * @param operationContext A string like 'create' or 'update' for logging purposes.
 * @returns A promise that resolves to the hashed password.
 * @throws An error if hashing fails.
 */
export async function hashPasswordWithEdgeFunction(password: string, operationContext: string = 'operation'): Promise<string> {
  console.log(`Invoking hash-collection-password Edge Function for ${operationContext}...`);
  const { data: hashData, error: hashError } = await supabase.functions.invoke<{ hashedPassword?: string; error?: string }>(
    'hash-collection-password',
    { body: { password } }
  );

  if (hashError) {
    console.error(`Edge function invocation error during ${operationContext}:`, hashError);
    throw new Error(hashError.message || `Failed to hash password via Edge Function for ${operationContext}.`);
  }
  if (hashData?.error) {
    console.error(`Edge function returned error during ${operationContext}:`, hashData.error);
    throw new Error(hashData.error || `Failed to hash password during ${operationContext}.`);
  }
  if (!hashData?.hashedPassword) {
    console.error(`Edge function did not return hashedPassword during ${operationContext}`);
    throw new Error(`Failed to retrieve hashed password from Edge Function for ${operationContext}.`);
  }
  console.log(`Password hashed successfully for ${operationContext}.`);
  return hashData.hashedPassword;
}
