import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ needsOTP: boolean }>;
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
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          setTimeout(async () => {
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        captchaToken
      }
    });
    
    if (error) throw error;
    return { needsOTP: true };
  };

  const verifyOTP = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    
    if (error) throw error;
    navigate("/");
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      signIn,
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
