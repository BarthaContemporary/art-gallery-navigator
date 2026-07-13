import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

type CookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: Record<string, unknown>): void;
};

/** Request-scoped client that respects the signed-in user's RLS. */
export function createServerSupabase(cookies: CookieStore) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: (
          all: { name: string; value: string; options?: Record<string, unknown> }[],
        ) => {
          try {
            all.forEach(({ name, value, options }) => cookies.set(name, value, options));
          } catch {
            // Called from a Server Component where cookies are read-only; middleware refreshes sessions.
          }
        },
      },
    },
  );
}

/** Service-role client — server only, bypasses RLS. Never expose to the browser. */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
