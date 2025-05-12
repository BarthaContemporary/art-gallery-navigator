import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ needsOTP: boolean }>;
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signInWithOTP: (email: string, captchaToken?: string) => Promise<{ needsOTP: boolean }>;
  verifyOTP: (email: string, token: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isArtist: boolean;
  isExternal: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log("Auth state changed:", event);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          setTimeout(async () => {
            try {
              const { data: adminRole } = await supabase.rpc('has_role', {
                _user_id: currentSession.user.id,
                _role: 'gallery_admin'
              });
              const { data: artistRole } = await supabase.rpc('has_role', {
                _user_id: currentSession.user.id,
                _role: 'artist'
              });
              const { data: externalRole } = await supabase.rpc('has_role', {
                _user_id: currentSession.user.id,
                _role: 'external'
              });
              setIsAdmin(!!adminRole);
              setIsArtist(!!artistRole);
              setIsExternal(!!externalRole);
            } catch (error) {
              console.error("Error checking user roles:", error);
            }
          }, 0);
        } else {
          setIsAdmin(false);
          setIsArtist(false);
          setIsExternal(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    console.log("Signing in with:", email, "CAPTCHA token provided:", !!captchaToken);
    
    if (password) {
      try {
        await signInWithPassword(email, password, captchaToken);
        return { needsOTP: false };
      } catch (error) {
        console.error("Password login failed:", error);
        if (error instanceof Error && (error.message.includes("Invalid login credentials") || captchaToken === "development-mode")) {
          return signInWithOTP(email, captchaToken);
        }
        throw error;
      }
    } else {
      return signInWithOTP(email, captchaToken);
    }
  };

  const signInWithPassword = async (email: string, password: string, captchaToken?: string) => {
    console.log("Signing in with password:", email, "CAPTCHA token provided:", !!captchaToken);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? {
        captchaToken
      } : undefined
    });
    
    if (error) {
      console.error("Sign in with password error:", error);
      throw error;
    }
    
    console.log("Password sign-in successful");
  };

  const signInWithOTP = async (email: string, captchaToken?: string) => {
    console.log("Sending OTP to:", email, "CAPTCHA token provided:", !!captchaToken);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        captchaToken: captchaToken
      }
    });
    
    if (error) {
      console.error("Sign in with OTP error:", error);
      throw error;
    }
    
    console.log("OTP sent successfully");
    return { needsOTP: true };
  };

  const verifyOTP = async (email: string, token: string) => {
    console.log("Verifying OTP for:", email);
    
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    
    if (error) {
      console.error("OTP verification error:", error);
      throw error;
    }
    
    console.log("OTP verification successful");
    navigate("/");
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      console.error("Sign up error:", error);
      throw error;
    }
    
    console.log("Sign up successful");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error("Sign out error:", error);
      throw error;
    }
    
    console.log("Sign out successful");
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      signIn,
      signInWithPassword,
      signInWithOTP,
      verifyOTP,
      signUp, 
      signOut, 
      isLoading,
      isAdmin,
      isArtist,
      isExternal
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
