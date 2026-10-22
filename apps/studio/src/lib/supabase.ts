import { cookies } from "next/headers";
import { cache } from "react";
import { createServerSupabase, createServiceClient } from "@jvb/db/server";
import type { UserRole } from "@jvb/db";

export async function getSupabase() {
  const cookieStore = await cookies();
  return createServerSupabase(cookieStore);
}

/** The `sub` claim of an access token, unverified; null if it cannot be read. */
function tokenSubject(accessToken: string | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

export const getSession = cache(async () => {
  const supabase = await getSupabase();
  const rolesFor = (userId: string) => supabase.from("user_roles").select("role").eq("user_id", userId);

  // getUser() verifies the token with the auth server, and the roles query
  // used to wait for it: two round trips before any page could start. The
  // user id is already in the session cookie, so the roles query now runs
  // beside getUser. That id is only a hint: PostgREST verifies the token on
  // the roles query itself, and the roles are used only if the id matches
  // the user getUser verified (otherwise they are read again for that user).
  // The id comes from the token rather than session.user, which the auth
  // client warns about reading on the server.
  const {
    data: { session: cookieSession },
  } = await supabase.auth.getSession();
  const claimedId = tokenSubject(cookieSession?.access_token);

  const [
    {
      data: { user },
    },
    early,
  ] = await Promise.all([supabase.auth.getUser(), claimedId ? rolesFor(claimedId) : Promise.resolve(null)]);
  if (!user) return null;

  const { data: roleRows } = early && claimedId === user.id ? early : await rolesFor(user.id);

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
