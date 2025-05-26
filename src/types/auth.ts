
import { Session, User } from "@supabase/supabase-js";

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password?: string) => Promise<{ needsOTP: boolean }>; // Removed captchaToken, password optional
  signInWithPassword: (email: string, password: string) => Promise<void>; // Removed captchaToken
  signInWithOTP: (email: string) => Promise<{ needsOTP: boolean }>; // Removed captchaToken
  verifyOTP: (email: string, token: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isExternal: boolean;
}
