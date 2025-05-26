
import { Session, User } from "@supabase/supabase-js";

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password?: string, captchaToken?: string) => Promise<{ needsOTP: boolean }>;
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInWithOTP: (email: string, captchaToken?: string) => Promise<{ needsOTP: boolean }>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<void>; // Added captchaToken here too for consistency
  signOut: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isExternal: boolean;
}
