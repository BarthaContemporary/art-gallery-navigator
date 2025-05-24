
import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { AuthContextType } from "@/types/auth";

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider. Make sure AuthProvider is a parent component.");
  }
  return context;
}
