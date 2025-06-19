
import React, { useMemo } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { useAuthCoreState } from "@/hooks/use-auth-core-state";
import { useUserRoles } from "@/hooks/use-user-roles";
import { useAuthActions } from "@/hooks/use-auth-actions";
import { AuthContextType } from "@/types/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { session, user, isLoading: isCoreLoading } = useAuthCoreState();
  const { isAdmin, isArtist, isExternal, isLoadingRoles, rolesError } = useUserRoles(user);
  const authActions = useAuthActions();

  // isLoading is primarily determined by the core authentication state.
  const isLoading = isCoreLoading;

  const value: AuthContextType = useMemo(() => ({
    session,
    user,
    ...authActions,
    isLoading,
    isAdmin,
    isArtist,
    isExternal,
    isLoadingRoles,
    rolesError,
  }), [session, user, authActions, isLoading, isAdmin, isArtist, isExternal, isLoadingRoles, rolesError]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
