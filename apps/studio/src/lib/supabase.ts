import { cookies } from "next/headers";
import { cache } from "react";
import { createServerSupabase, createServiceClient } from "@jvb/db/server";
import type { UserRole } from "@jvb/db";

export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerSupabase(cookieStore);
}

export const getSession = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const roles = (roleRows ?? []).map((r) => r.role as UserRole);
  return { user, roles };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export function hasRole(roles: UserRole[], ...wanted: UserRole[]) {
  return wanted.some((w) => roles.includes(w));
}

/** True when the user may see purchase costs, margins and invoices. */
export function canSeeFinancials(roles: UserRole[]) {
  return hasRole(roles, "admin", "accountant");
}

export { createServiceClient };
