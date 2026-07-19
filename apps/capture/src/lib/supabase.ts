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

export function hasRole(roles: UserRole[], ...wanted: UserRole[]) {
  return wanted.some((w) => roles.includes(w));
}

/** The capture app is for staff entering new stock; admins included. */
export function canCapture(roles: UserRole[]) {
  return hasRole(roles, "admin", "staff");
}

/**
 * Guard for API routes: returns the authenticated capture user or a 401/403
 * response. Keeps every route's preamble to one line.
 */
export async function requireCapture() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" as const, status: 401 as const };
  if (!canCapture(session.roles))
    return { error: "Forbidden" as const, status: 403 as const };
  return { session };
}

export { createServiceClient };
