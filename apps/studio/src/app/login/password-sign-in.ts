import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { loginErrorFromAuth, type AuthErrorLike } from "./sign-in";

/**
 * Asks the auth server (GoTrue) to sign in with a password, then keeps the
 * session in this browser's cookies. Returns the auth server's error, or
 * null. The studio and the capture app each keep this file, identical, next
 * to sign-in.ts: change both together.
 *
 * The request carries the service-role key, not the public one. GoTrue's own
 * Cloudflare check (GOTRUE_SECURITY_CAPTCHA_ENABLED, docs/ops/
 * security-runbook.md step 7) lets requests made with that key through, so it
 * guards only callers that skip the sign-in page. The page has already
 * checked the visitor's Cloudflare token, and Cloudflare accepts each token
 * once, so none is left to pass on. The client is made for this one request,
 * keeps nothing and renews nothing, so the session is never held or renewed
 * on the server; the cookie client takes it over.
 */
export async function passwordSignIn(email: string, password: string): Promise<AuthErrorLike | null> {
  const error = await signInAndKeep(email, password);
  // A wrong password or a full count is expected; anything else means the
  // set-up needs a look, so the reason goes to the server log (never the
  // email or the password).
  if (error && loginErrorFromAuth(error) === "failed") {
    console.error("[login] the auth server refused a password sign-in:", error.status ?? "", error.code ?? "", error.message ?? "");
  }
  return error;
}

async function signInAndKeep(email: string, password: string): Promise<AuthErrorLike | null> {
  const supabase = await getSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // A setup without the service-role key (local development) signs in with
    // the public key, as before; that works only while GoTrue's check is off.
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }

  const server = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await server.auth.signInWithPassword({ email, password });
  if (error) return error;
  if (!data.session) return { message: "no session returned" };
  const { error: keepError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return keepError;
}
